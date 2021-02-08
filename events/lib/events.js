const errors = require('./errors');
const merge = require('./merge');
const constants = require('./constants');
const helpers = require('./helpers');
const { Event, Application } = require('../models');
const { Sequelize, sequelize } = require('./sequelize');
const core = require('./core');
const mailer = require('./mailer');
const config = require('../config');

exports.listEvents = async (req, res) => {
    // Get default query obj.
    const defaultQueryObj = helpers.getDefaultQuery(req);

    // Applying custom filter: deleted = false, status === published.
    const queryObj = merge(defaultQueryObj, {
        where: {
            deleted: false,
            status: 'published'
        }
    });

    const events = await Event.findAll(queryObj);

    return res.json({
        success: true,
        data: events,
        meta: {
            offset: queryObj.offset,
            limit: queryObj.limit
        }
    });
};

// All applications for bodies, including events.
exports.listBodyApplications = async (req, res) => {
    const bodyId = Number(req.params.body_id);
    if (Number.isNaN(bodyId)) {
        return errors.makeBadRequestError(res, 'bodyId is not a number.');
    }

    // Only visible to board members
    if (!req.permissions.see_boardview[bodyId]) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this');
    }

    const applications = await Application.findAll({
        where: { body_id: bodyId },
        include: [Event]
    });

    return res.json({
        success: true,
        data: applications,
    });
};

// Returns all events the user is organizer on
exports.listUserOrganizedEvents = async (req, res) => {
    const defaultQueryObj = helpers.getDefaultQuery(req);
    const queryObj = merge(defaultQueryObj, {
        where: {
            deleted: false,
            organizers: { [Sequelize.Op.contains]: [{ user_id: req.user.id }] }
        }
    });

    const events = await Event.findAll(queryObj);

    return res.json({
        success: true,
        data: events,
    });
};

// List all the event where the user is participant at.
exports.listUserAppliedEvents = async (req, res) => {
    const defaultQueryObj = helpers.getDefaultQuery(req);
    const queryObj = merge(defaultQueryObj, {
        where: {
            deleted: false,
            '$applications.user_id$': req.user.id
        },
        subQuery: false,
        include: [{
            model: Application,
            attributes: ['user_id', 'status'], // pass along user_id, as well as the status of the application
            required: true
        }]
    });

    // The subQuery: false line is super important as if we'll remove it,
    // the query will fail with `missing FROM-clause entry for table "applications"`
    // error. It's a regression bug in Sequelize, more info
    // here: https://github.com/sequelize/sequelize/issues/9869

    const events = await Event.findAll(queryObj);

    return res.json({
        success: true,
        data: events,
    });
};

exports.listApprovableEvents = async (req, res) => {
    const allowedEventTypes = Object.keys(req.permissions.approve_event)
        .filter((key) => req.permissions.approve_event[key]);

    const events = await Event.findAll({
        where: {
            deleted: false,
            status: { [Sequelize.Op.ne]: 'published' },
            type: { [Sequelize.Op.in]: allowedEventTypes }
        }
    });

    return res.json({
        success: true,
        data: events,
    });
};

exports.addEvent = async (req, res) => {
    // Make sure the user doesn't insert malicious stuff
    const data = req.body;
    delete data.id;
    delete data.status;
    delete data.deleted;

    const event = new Event(data);

    // we'll catch these on validation inside the Event model.
    if (Array.isArray(event.organizers)) {
        if (!event.organizers.some((org) => org.user_id === req.user.id)) {
            return errors.makeForbiddenError(res, 'User creating the event should be the organizers.');
        }

        event.organizers = await Promise.all(event.organizers.map((organizer) =>
            core.fetchUser(organizer, req.headers['x-auth-token'])));
    }

    if (Array.isArray(event.organizing_bodies)) {
        event.organizing_bodies = await Promise.all(event.organizing_bodies.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    await sequelize.transaction(async (t) => {
        // Creating the event in a transaction, so if mail sending fails, the update would be reverted.
        await event.save({ transaction: t });

        // Sending the mail to a user.
        await mailer.sendMail({
            to: event.organizers.map((organizer) => organizer.notification_email),
            subject: 'The event was created',
            template: 'events_event_created.html',
            parameters: {
                event
            }
        });
    });

    return res.status(201).json({
        success: true,
        message: 'Event successfully created',
        data: event,
    });
};

exports.eventDetails = async (req, res) => {
    if (!req.permissions.see_event) {
        return errors.makeForbiddenError(res, 'You cannot see this event.');
    }

    let event = req.event.toJSON();

    // Some fields shouldn't be public and only should be displayed to EQAC/CD/admins/organizers.
    if (!helpers.isOrganizer(event, req.user)
        && !req.permissions.manage_event[event.type]
        && !req.permissions.approve_event[event.type]) {
        event = helpers.whitelistObject(event, constants.EVENT_PUBLIC_FIELDS);
    }

    return res.json({
        success: true,
        data: event,
        permissions: req.permissions
    });
};

exports.editEvent = async (req, res) => {
    // If user can't edit anything, return error right away
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You cannot edit this event');
    }

    const data = req.body;
    const event = req.event;

    delete data.id;
    delete data.status;
    delete data.deleted;

    if (Object.keys(data).length === 0) {
        return errors.makeValidationError(res, 'No valid field changes requested');
    }

    if (Array.isArray(data.organizers)) {
        data.organizers = await Promise.all(data.organizers.map((organizer) => core.fetchUser(organizer, req.headers['x-auth-token'])));
    }

    if (Array.isArray(data.organizing_bodies)) {
        data.organizing_bodies = await Promise.all(data.organizing_bodies.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    await sequelize.transaction(async (t) => {
        // Updating the event in a transaction, so if mail sending fails, the update would be reverted.
        await event.update(data, { transaction: t });

        // Sending the mail to a user.
        await mailer.sendMail({
            to: event.organizers.map((organizer) => organizer.notification_email),
            subject: 'The event was updated',
            template: 'events_event_updated.html',
            parameters: {
                event
            }
        });
    });

    return res.json({
        success: true,
        data: event.toJSON()
    });
};

exports.deleteEvent = async (req, res) => {
    if (!req.permissions.delete_event) {
        return errors.makeForbiddenError(res, 'You are not permitted to delete this event.');
    }

    // Deletion is only setting the 'deleted' field to true.
    await req.event.update({ deleted: true });

    return res.json({
        success: true,
        message: 'Event successfully deleted',
    });
};

exports.setApprovalStatus = async (req, res) => {
    if (!req.permissions.change_status[req.body.status]) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status.');
    }

    const oldStatus = req.event.status;

    await sequelize.transaction(async (t) => {
        await req.event.update({ status: req.body.status }, { transaction: t });

        // Send email to all organizers.
        await mailer.sendMail({
            to: req.event.organizers.map((organizer) => organizer.notification_email),
            subject: 'Your event\'s status was changed',
            template: 'events_status_changed.html',
            parameters: {
                event: req.event,
                old_status: oldStatus
            }
        });

        // If the new status is submitted and the old status is draft, send a mail
        // to those who have permissions (EQAC/CD)
        if (oldStatus !== 'draft' || req.event.status !== 'submitted') {
            return;
        }

        await mailer.sendMail({
            to: config.new_event_notifications,
            subject: 'A new event was submitted.',
            template: 'events_submitted.html',
            parameters: {
                event: req.event
            }
        });
    });

    return res.json({
        success: true,
        message: 'Successfully changed approval status',
    });
};
