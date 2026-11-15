const xlsx = require('node-xlsx');

const core = require('./core');
const errors = require('./errors');
const { Application, Event } = require('../models');
const helpers = require('./helpers');
const mailer = require('./mailer');
const { sequelize, Sequelize } = require('./sequelize');

function isApplicationBanActive(user) {
    return user.event_application_ban && new Date(user.event_application_ban.ban_until) > new Date();
}

function canListFutureApplicationsForBan(corePermissions) {
    return Array.isArray(corePermissions)
        && corePermissions.some((permission) => permission.combined === 'global:update_application_ban:member');
}

exports.listFutureApplicationsForUser = async (req, res) => {
    // People who manage application bans see everything, people who manage
    // events of some types only see applications for events of those types.
    const canSeeAllTypes = canListFutureApplicationsForBan(req.corePermissions);
    const managedTypes = Object.keys(req.permissions.manage_event).filter((type) => req.permissions.manage_event[type]);

    if (!canSeeAllTypes && managedTypes.length === 0) {
        return errors.makeForbiddenError(res, 'You are not allowed to see future applications.');
    }

    if (!helpers.isNumber(req.params.user_id)) {
        return errors.makeBadRequestError(res, 'User ID should be a number.');
    }

    const applications = await Application.findAll({
        where: {
            user_id: Number(req.params.user_id),
            status: { [Sequelize.Op.in]: ['pending', 'accepted'] }
        },
        include: [{
            model: Event,
            required: true,
            where: {
                starts: { [Sequelize.Op.gt]: new Date() },
                deleted: false,
                ...(!canSeeAllTypes && { type: { [Sequelize.Op.in]: managedTypes } })
            }
        }],
        order: [[Event, 'starts', 'ASC']]
    });

    return res.json({
        success: true,
        data: applications.map((application) => ({
            service: 'events',
            application_id: application.id,
            application_status: application.status,
            event_id: application.event.id,
            event_name: application.event.name,
            event_type: application.event.type,
            event_starts: application.event.starts
        }))
    });
};

exports.listAllApplications = async (req, res) => {
    if (!req.permissions.list_applications) {
        return errors.makeForbiddenError(res, 'You cannot see applications for this event.');
    }

    const applications = await Application.findAll({
        where: { event_id: req.event.id },
        order: [['created_at', 'ASC']]
    });

    return res.json({
        success: true,
        data: applications,
    });
};

exports.getApplication = async (req, res) => {
    if (!req.permissions.view_application) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this application.');
    }

    return res.json({
        success: true,
        data: req.application,
    });
};

exports.createApplication = async (req, res) => {
    // Check for permission
    if (!req.permissions.apply || !req.event.has_applications) {
        return errors.makeForbiddenError(res, 'You cannot apply to this event.');
    }

    if (isApplicationBanActive(req.user)) {
        return errors.makeForbiddenError(res, 'You are temporarily banned from applying to events.');
    }

    if (typeof req.body.body_id !== 'undefined' && !helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeBadRequestError(res, 'You are not a member of this body.');
    }

    delete req.body.board_comment;
    delete req.body.status;

    req.body.first_name = req.user.first_name;
    req.body.last_name = req.user.last_name;
    req.body.body_name = req.user.bodies.find((b) => b.id === req.body.body_id).name;
    req.body.user_id = req.user.id;
    req.body.event_id = req.event.id;

    let newApplication;

    // Doing it inside of a transaction, so it'd fail and revert if mail was not sent.
    await sequelize.transaction(async (t) => {
        newApplication = await Application.create(req.body, { transaction: t });

        // Sending the mail to a user.
        await mailer.sendMail({
            to: req.user.notification_email,
            subject: `You've successfully applied for ${req.event.name}`,
            template: 'events_applied.html',
            parameters: {
                application: newApplication,
                event: req.event
            }
        });
    });

    return res.json({
        success: true,
        message: 'Application is created.',
        data: newApplication,
    });
};

exports.updateApplication = async (req, res) => {
    // Check for permission
    if (!req.permissions.edit_application) {
        return errors.makeForbiddenError(res, 'You cannot edit this application.');
    }

    // The application can also be edited by organizers and event managers, so the
    // applicant's details come from the applicant, not from whoever is editing.
    const applicant = req.applicant;
    const applicantBody = typeof req.body.body_id !== 'undefined'
        ? applicant.bodies.find((body) => body.id === req.body.body_id)
        : null;

    if (typeof req.body.body_id !== 'undefined' && !applicantBody) {
        return errors.makeForbiddenError(res, 'The applicant is not a member of this body.');
    }

    delete req.body.board_comment;
    delete req.body.status;

    req.body.first_name = applicant.first_name;
    req.body.last_name = applicant.last_name;
    if (applicantBody) {
        req.body.body_name = applicantBody.name;
    }
    req.body.user_id = applicant.id;
    req.body.event_id = req.event.id;

    await sequelize.transaction(async (t) => {
        // Updating application in a transaction, so if mail sending fails, the update would be reverted.
        await req.application.update(req.body, { transaction: t });

        // Sending the mail to the applicant.
        await mailer.sendMail({
            to: applicant.notification_email,
            subject: `Your application for ${req.event.name} was updated`,
            template: 'events_edited.html',
            parameters: {
                application: req.application,
                event: req.event
            }
        });
    });

    return res.json({
        success: true,
        message: 'Application is updated',
        data: req.application,
    });
};

exports.setApplicationConfirmed = async (req, res) => {
    if (!req.permissions.set_participants_confirmed) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to change this application.');
    }

    const dbResult = await req.application.update(
        { confirmed: req.body.confirmed },
        { returning: ['*'] }
    );

    return res.json({
        success: true,
        data: dbResult
    });
};

exports.setApplicationAttended = async (req, res) => {
    if (!req.permissions.set_participants_attended) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to change this application.');
    }

    const dbResult = await req.application.update(
        { attended: req.body.attended },
        { returning: ['*'] }
    );

    return res.json({
        success: true,
        data: dbResult
    });
};

exports.setApplicationStatus = async (req, res) => {
    // Check user permissions
    if (!req.permissions.approve_participants) {
        return errors.makeForbiddenError(res, 'You are not allowed to accept or reject participants');
    }

    await req.application.update({ status: req.body.status });

    return res.json({
        success: true,
        data: req.application
    });
};

exports.setApplicationComment = async (req, res) => {
    // Check user permissions
    if (!req.permissions.set_board_comment[req.application.body_id]) {
        return errors.makeForbiddenError(res, 'You are not allowed to put board comments');
    }

    // Save changes
    await req.application.update({ board_comment: req.body.board_comment });

    return res.json({
        success: true,
        data: req.application
    });
};

exports.exportAll = async (req, res) => {
    // Exporting users as XLSX .
    if (!req.permissions.export) {
        return errors.makeForbiddenError(res, 'You are not allowed to see statistics.');
    }

    let applications = await Application.findAll({ where: { event_id: req.event.id } });

    const headersNames = helpers.getApplicationFields(req.event);
    const headers = Object.keys(headersNames).map((field) => headersNames[field]);

    applications = await Promise.all(applications
        .map(async (application) => {
            const user = await core.fetchApplicationUser(application.user_id);

            application.dataValues.notification_email = user.notification_email;

            return application;
        }));

    const resultArray = applications
        .map((application) => application.toJSON())
        .map((application) => helpers.flattenObject(application))
        .map((application) => {
            return Object.keys(headersNames).map((field) => helpers.beautify(application[field]));
        });

    const resultBuffer = xlsx.build([
        {
            name: 'Application stats',
            data: [
                headers,
                ...resultArray
            ]
        }
    ]);

    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-disposition', 'attachment; filename=stats.xlsx');

    return res.send(resultBuffer);
};
