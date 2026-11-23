const xlsx = require('node-xlsx').default;

const core = require('./core');
const errors = require('./errors');
const { Application, Event } = require('../models');
const helpers = require('./helpers');
const mailer = require('./mailer');
const { sequelize, Sequelize } = require('./sequelize');

// The fields an applicant sets. The others are set by the server (applicant, event, body name)
// or through their own endpoints (status, board comment, confirmed, attended, cancelled).
const APPLICATION_FIELDS = [
    'body_id',
    'nationality',
    'travelling_from',
    'visa_required',
    'visa_place_of_birth',
    'visa_passport_number',
    'visa_passport_issue_date',
    'visa_passport_expiration_date',
    'visa_passport_issue_authority',
    'visa_embassy',
    'visa_street_and_house',
    'visa_postal_code',
    'visa_city',
    'visa_country',
    'aegee_experience',
    'ideal_su',
    'motivation',
    'answers',
    'meals',
    'allergies',
    'agreed_to_privacy_policy',
    'agreed_to_su_terms'
];

const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected'];

// The flag routes take one field each. A missing value used to change nothing and still
// answer 200 (and send the status mail), so it is checked first.
const requireBoolean = (res, body, field) => {
    if (typeof body[field] !== 'boolean') {
        helpers.makeFieldError(res, field, 'The value should be true or false.');
        return false;
    }
    return true;
};

// Adds the applicant's details from core, which the application responses include.
const addApplicantFields = (application, user) => {
    application.dataValues.gender = user.gender;
    application.dataValues.date_of_birth = user.date_of_birth;
    application.dataValues.notification_email = user.notification_email;
    return application;
};

function isApplicationBanActive(user) {
    return user.event_application_ban && new Date(user.event_application_ban.ban_until) > new Date();
}

function canListFutureApplicationsForBan(corePermissions) {
    return Array.isArray(corePermissions)
        && corePermissions.some((permission) => permission.combined === 'global:update_application_ban:member');
}

exports.listFutureApplicationsForUser = async (req, res) => {
    if (!canListFutureApplicationsForBan(req.corePermissions) && !Object.values(req.permissions.manage_summeruniversity).some(Boolean)) {
        return errors.makeForbiddenError(res, 'You are not allowed to see future applications.');
    }

    if (!helpers.isNumber(req.params.user_id)) {
        return errors.makeBadRequestError(res, 'User ID should be a number.');
    }

    const applications = await Application.findAll({
        where: {
            user_id: Number(req.params.user_id),
            cancelled: false,
            status: { [Sequelize.Op.in]: ['pending', 'accepted'] }
        },
        include: [{
            model: Event,
            required: true,
            where: {
                starts: { [Sequelize.Op.gt]: new Date() },
                deleted: false
            }
        }],
        order: [[Event, 'starts', 'ASC']]
    });

    return res.json({
        success: true,
        data: applications.map((application) => ({
            service: 'summeruniversity',
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
        data: helpers.applicationForCaller(req.application, req),
        permissions: req.permissions
    });
};

exports.createApplication = async (req, res) => {
    // Check for permission
    if (!req.permissions.apply) {
        return errors.makeForbiddenError(res, 'You cannot apply to this event.');
    }

    if (isApplicationBanActive(req.user)) {
        return errors.makeForbiddenError(res, 'You are temporarily banned from applying to events.');
    }

    const body = req.user.bodies.find((b) => b.id === Number(req.body.body_id));
    if (!body) {
        return errors.makeBadRequestError(res, 'You are not a member of this body.');
    }

    const application = {
        ...helpers.whitelistObject(req.body, APPLICATION_FIELDS),
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        body_id: body.id,
        body_name: body.name,
        user_id: req.user.id,
        event_id: req.event.id
    };

    let newApplication;

    // Doing it inside of a transaction, so it'd fail and revert if mail was not sent.
    await sequelize.transaction(async (t) => {
        newApplication = await Application.create(application, { transaction: t });

        // Sending the mail to a user.
        await mailer.sendMail({
            to: req.user.notification_email,
            subject: `You've successfully applied for ${req.event.name}`,
            template: 'summeruniversity_applied.html',
            parameters: {
                application: newApplication,
                event: req.event
            }
        });

        const adminToken = await core.getAdminToken();
        req.event.organizers = await Promise.all(req.event.organizers.map((organizer) =>
            core.fetchUser(organizer, adminToken)));

        // Sending the mail to the organizers
        await mailer.sendMail({
            to: req.event.organizers.map((organizer) => organizer.notification_email),
            subject: `Somebody has applied for ${req.event.name}`,
            template: 'summeruniversity_organizer_applied.html',
            parameters: {
                application: newApplication,
                event: req.event
            }
        });

        // Sending emails to board members of this body.
        const boardMembers = await core.getBodyUsersForPermission({
            action: 'approve_members',
            object: 'summeruniversity'
        }, newApplication.body_id);

        if (boardMembers.length > 0) {
            await mailer.sendMail({
                to: boardMembers.map((member) => member.user.notification_email),
                subject: `One of your body members has applied to ${req.event.name}`,
                template: 'summeruniversity_board_applied.html',
                parameters: {
                    application: newApplication,
                    event: req.event
                }
            });
        }
    });

    return res.json({
        success: true,
        message: 'Application is created.',
        data: helpers.applicationForCaller(newApplication, req),
    });
};

exports.updateApplication = async (req, res) => {
    // Check for permission
    if (!req.permissions.edit_application) {
        return errors.makeForbiddenError(res, 'You cannot edit this application.');
    }

    // The application can also be edited by organizers and SU managers, so the
    // applicant's details come from the applicant, not from whoever is editing.
    const applicant = req.applicant;
    const application = helpers.whitelistObject(req.body, APPLICATION_FIELDS);
    application.first_name = applicant.first_name;
    application.last_name = applicant.last_name;

    // Only a new body is checked: the applicant may have left the body they applied with.
    if (application.body_id !== undefined && Number(application.body_id) !== req.application.body_id) {
        const applicantBody = applicant.bodies.find((body) => body.id === Number(application.body_id));
        if (!applicantBody) {
            return errors.makeForbiddenError(res, 'The applicant is not a member of this body.');
        }

        application.body_id = applicantBody.id;
        application.body_name = applicantBody.name;
    }

    await sequelize.transaction(async (t) => {
        // Updating application in a transaction, so if mail sending fails, the update would be reverted.
        await req.application.update(application, { transaction: t });

        // Sending the mail to the applicant.
        await mailer.sendMail({
            to: applicant.notification_email,
            subject: `Your application for ${req.event.name} was updated`,
            template: 'summeruniversity_application_edited.html',
            parameters: {
                application: req.application,
                event: req.event
            }
        });

        const adminToken = await core.getAdminToken();
        req.event.organizers = await Promise.all(req.event.organizers.map((organizer) =>
            core.fetchUser(organizer, adminToken)));

        // Sending the mail to the organizers
        await mailer.sendMail({
            to: req.event.organizers.map((organizer) => organizer.notification_email),
            subject: `Somebody has updated their application for ${req.event.name}`,
            template: 'summeruniversity_organizer_edited.html',
            parameters: {
                application: req.application,
                event: req.event
            }
        });

        // Sending emails to board members of this body.
        const boardMembers = await core.getBodyUsersForPermission({
            action: 'approve_members',
            object: 'summeruniversity'
        }, req.application.body_id);

        if (boardMembers.length > 0) {
            await mailer.sendMail({
                to: boardMembers.map((member) => member.user.notification_email),
                subject: `One of your body members has updated their application to ${req.event.name}`,
                template: 'summeruniversity_board_edited.html',
                parameters: {
                    application: req.application,
                    event: req.event
                }
            });
        }
    });

    // Answer with what was stored: a body id sent as a string is an integer in the database.
    await req.application.reload();
    addApplicantFields(req.application, applicant);

    return res.json({
        success: true,
        message: 'Application is updated',
        data: helpers.applicationForCaller(req.application, req),
    });
};

// Reads the application again inside the transaction of helpers.changeWithLockedEvent, and locks
// its row: req.application was fetched before the Summer University was locked, so another change
// may have changed it since. Every decision of a locked change is made from this row. The
// applicant's details from core that fetchSingleApplication added (gender, date of birth,
// notification email) are kept for the answer.
const lockApplication = async (req, transaction) => {
    const fromCore = Object.fromEntries(Object.entries(req.application.dataValues)
        .filter(([key]) => !Object.prototype.hasOwnProperty.call(Application.rawAttributes, key)));
    await req.application.reload({ transaction, lock: transaction.LOCK.UPDATE });
    Object.assign(req.application.dataValues, fromCore);
};

exports.setApplicationConfirmed = async (req, res) => {
    if (!req.permissions.set_participants_confirmed) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to change this application.');
    }

    if (!requireBoolean(res, req.body, 'confirmed')) {
        return undefined;
    }

    let dbResult;
    // Locked like the status changes, which clear the confirmation, and decided from the
    // application as they left it.
    const answered = await helpers.changeWithLockedEvent(req, res, async (event, t) => {
        await lockApplication(req, t);

        // Only participants who were accepted and did not cancel can confirm their participation.
        if (req.body.confirmed && (req.application.status !== 'accepted' || req.application.cancelled)) {
            throw new helpers.FieldError('confirmed', 'Only accepted applications that are not cancelled can be confirmed.');
        }

        dbResult = await req.application.update(
            { confirmed: req.body.confirmed },
            { returning: ['*'], transaction: t }
        );
    });
    if (answered) {
        return undefined;
    }

    return res.json({
        success: true,
        data: dbResult
    });
};

exports.setApplicationAttended = async (req, res) => {
    if (!req.permissions.set_participants_attended) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to change this application.');
    }

    if (!requireBoolean(res, req.body, 'attended')) {
        return undefined;
    }

    let dbResult;
    // Locked like the status changes, which refuse an attended application and clear the
    // confirmation that attendance needs.
    const answered = await helpers.changeWithLockedEvent(req, res, async (event, t) => {
        await lockApplication(req, t);

        dbResult = await req.application.update(
            { attended: req.body.attended },
            { returning: ['*'], transaction: t }
        );
    });
    if (answered) {
        return undefined;
    }

    return res.json({
        success: true,
        data: dbResult
    });
};

const NO_SPOTS_LEFT = 'There are no spots left: the event already has max_participants accepted participants.';
// Whether the accepted, not cancelled applications other than this one fill max_participants
// of the locked event. Without max_participants there is no limit.
const isFull = async (event, application, transaction) => {
    if (event.max_participants === null) {
        return false;
    }

    const acceptedOthers = await Application.count({
        where: {
            event_id: event.id,
            status: 'accepted',
            cancelled: false,
            id: { [Sequelize.Op.ne]: application.id }
        },
        transaction
    });
    return acceptedOthers >= event.max_participants;
};

// Counts the accepted participants that did not cancel, inside the transaction that changed an
// application, so that the count and the application are saved together.
const recountAcceptedParticipants = async (event, transaction) => {
    const acceptedParticipants = await Application.count({
        where: { event_id: event.id, status: 'accepted', cancelled: false },
        transaction
    });
    await event.update({ accepted_participants: acceptedParticipants }, { transaction });
};

// Managers of the Summer University's type are not limited by max_participants.
const mayExceedLimit = (req) => Boolean(req.permissions.manage_summeruniversity[req.event.type]);

exports.setApplicationCancelled = async (req, res) => {
    if (!req.permissions.set_participants_cancelled && !req.permissions.set_application_cancelled) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to change this application.');
    }

    if (!requireBoolean(res, req.body, 'cancelled')) {
        return undefined;
    }

    // Taking back one's own cancellation is applying again, so the ban applies. Organizers
    // and managers are not limited by the applicant's ban.
    const isOwnUncancel = req.body.cancelled === false
        && req.application.user_id === req.user.id
        && !req.permissions.set_participants_cancelled;
    if (isOwnUncancel && isApplicationBanActive(req.user)) {
        return errors.makeForbiddenError(res, 'You are temporarily banned from applying to events.');
    }

    let dbResult;
    const answered = await helpers.changeWithLockedEvent(req, res, async (event, t) => {
        await lockApplication(req, t);

        // An accepted application that comes back from cancelled takes a spot again.
        const takesSpotBack = req.body.cancelled === false && req.application.cancelled && req.application.status === 'accepted';
        if (takesSpotBack && !mayExceedLimit(req) && await isFull(event, req.application, t)) {
            throw new helpers.FieldError('cancelled', NO_SPOTS_LEFT);
        }

        dbResult = await req.application.update(
            { cancelled: req.body.cancelled },
            { returning: ['*'], transaction: t }
        );

        await recountAcceptedParticipants(event, t);
    });
    if (answered) {
        return undefined;
    }

    return res.json({
        success: true,
        data: helpers.applicationForCaller(dbResult, req)
    });
};

exports.setApplicationStatus = async (req, res) => {
    // Check user permissions
    if (!req.permissions.approve_participants) {
        return errors.makeForbiddenError(res, 'You are not allowed to accept or reject participants');
    }

    if (!APPLICATION_STATUSES.includes(req.body.status)) {
        return helpers.makeFieldError(res, 'status', `The status should be one of: ${APPLICATION_STATUSES.join(', ')}.`);
    }

    const answered = await helpers.changeWithLockedEvent(req, res, async (event, t) => {
        await lockApplication(req, t);

        // Only accepted applications can be confirmed, so the confirmation goes when it stops
        // being accepted. Attendance needs the confirmation, so it has to be taken back first.
        const stopsBeingAccepted = req.application.status === 'accepted' && req.body.status !== 'accepted';
        if (stopsBeingAccepted && req.application.attended) {
            throw new helpers.FieldError('status', 'This application is marked as attended: mark it as not attended before changing its status.');
        }
        const changes = stopsBeingAccepted ? { status: req.body.status, confirmed: false } : { status: req.body.status };

        // Accepting needs a free spot. A cancelled application does not count, so accepting it
        // takes none.
        const takesSpot = req.body.status === 'accepted' && !req.application.cancelled;
        if (takesSpot && !mayExceedLimit(req) && await isFull(event, req.application, t)) {
            throw new helpers.FieldError('status', NO_SPOTS_LEFT);
        }

        // In the transaction, so if mail sending fails, the update is reverted.
        await req.application.update(changes, { transaction: t });

        const adminToken = await core.getAdminToken();
        const notificationEmail = (await core.fetchUser(req.application, adminToken)).notification_email;

        // Sending the mail to a user.
        await mailer.sendMail({
            to: notificationEmail,
            subject: `Your application status for ${req.event.name} was updated`,
            template: 'summeruniversity_application_status_updated.html',
            parameters: {
                application: req.application,
                event: req.event
            }
        });

        await recountAcceptedParticipants(event, t);
    });
    if (answered) {
        return undefined;
    }

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

    if (typeof req.body.board_comment !== 'string' && req.body.board_comment !== null) {
        return helpers.makeFieldError(res, 'board_comment', 'board_comment should be a text or null.');
    }

    // Save changes
    await req.application.update({ board_comment: req.body.board_comment });

    return res.json({
        success: true,
        data: req.application
    });
};

exports.exportAll = async (req, res) => {
    // Exporting users as XLSX.
    if (!req.permissions.export_pax) {
        return errors.makeForbiddenError(res, 'You are not allowed to export participants.');
    }

    let applications = await Application.findAll({ where: {
        event_id: req.event.id,
        cancelled: false,
        status: { [Sequelize.Op.ne]: 'rejected' }
    } });

    const headersNames = helpers.getApplicationFields(req.event);

    const headers = Object.keys(headersNames).map((field) => headersNames[field]);

    // One admin login for the whole export.
    const adminToken = await core.getAdminToken();
    applications = await Promise.all(applications
        .map(async (application) => {
            const user = await core.fetchApplicationUser(application.user_id, adminToken);
            return addApplicantFields(application, user);
        }));

    // TODO: if status != accepted do not return visa fields
    const resultArray = applications
        .map((application) => application.toJSON())
        .map((application) => helpers.flattenObject(application))
        .map((application) => {
            return Object.keys(headersNames).map((field) => helpers.beautify(application[field]));
        });

    const resultBuffer = xlsx.build([
        {
            name: 'Participants',
            data: [
                headers,
                ...resultArray
            ]
        }
    ]);

    // res.attachment() quotes the name and adds a UTF-8 version (RFC 5987) for characters
    // outside latin1, which a raw header value cannot carry.
    res.attachment('participants_' + req.event.name + '_' + new Date().toISOString() + '.xlsx');
    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return res.send(resultBuffer);
};

// The statistics cover every Summer University, so only SU managers and approvers can see them.
const canSeeStats = (permissions) => Object.values(permissions.manage_summeruniversity).some(Boolean)
    || Object.values(permissions.approve_summeruniversity).some(Boolean);

// Returns the season as a number, null when it's not given, or NaN when it's not a four-digit year.
// Anything but a plain string (an array from `season[]=`, or `true` from the boolean query parser) is invalid.
const parseSeason = (season) => {
    if (season === undefined || season === '') {
        return null;
    }

    return typeof season === 'string' && /^\d{4}$/.test(season) ? Number(season) : NaN;
};

const calculateStats = async (season) => {
    const statsObject = {
        by_event: [],
        by_body: [],
        by_nationality: [],
        by_status: []
    };

    let applicationQuery = { attributes: ['user_id', 'event_id', 'body_name', 'nationality', 'confirmed'] };
    let eventQuery = { attributes: ['id', 'name'] };

    if (season !== null) {
        applicationQuery = { ...applicationQuery, ...{ include: [{ model: Event, where: { season } }] } };
        eventQuery = { ...eventQuery, ...{ where: { season } } };
    }

    const applications = await Application.findAll(applicationQuery);
    const events = await Event.findAll(eventQuery);

    statsObject.by_event = helpers
        .countByField(applications, 'event_id')
        .map(({ type, value }) => ({ type: events.find((event) => event.id === type).name, value }));

    const uniqueApplicationUsers = Array.from(
        new Map(applications.map((app) => [app.user_id, app])).values()
    );

    statsObject.by_body = helpers.countByField(uniqueApplicationUsers, 'body_name');
    statsObject.by_nationality = helpers.countByField(uniqueApplicationUsers, 'nationality');

    statsObject.by_status = [
        { type: 'total_applications', value: applications.length },
        { type: 'total_members', value: uniqueApplicationUsers.length },
        { type: 'confirmed', value: applications.filter((app) => app.confirmed === true).length }
    ];

    return statsObject;
};

exports.getStats = async (req, res) => {
    if (!canSeeStats(req.permissions)) {
        return errors.makeForbiddenError(res, 'You are not allowed to see the application statistics.');
    }

    const season = parseSeason(req.query.season);
    if (Number.isNaN(season)) {
        return errors.makeBadRequestError(res, 'Season should be a year.');
    }

    return res.json({
        success: true,
        data: await calculateStats(season)
    });
};

exports.exportStatsByBody = async (req, res) => {
    if (!canSeeStats(req.permissions)) {
        return errors.makeForbiddenError(res, 'You are not allowed to export the application statistics.');
    }

    const season = parseSeason(req.query.season);
    if (season === null || Number.isNaN(season)) {
        return errors.makeBadRequestError(res, 'Season should be a year.');
    }

    const { by_body: byBody } = await calculateStats(season);

    const resultBuffer = xlsx.build([
        {
            name: 'By body',
            data: [
                ['Body', 'Applicants'],
                ...byBody
                    .sort((a, b) => b.value - a.value || a.type.localeCompare(b.type))
                    .map(({ type, value }) => [type, value])
            ]
        }
    ]);

    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-disposition', 'attachment; filename=su_stats_by_body_' + season + '.xlsx');

    return res.send(resultBuffer);
};
