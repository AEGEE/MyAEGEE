const moment = require('moment');

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
        },
        attributes: constants.EVENT_PUBLIC_FIELDS
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

// TODO: See if we want to you this function for something else than the AC check
exports.listMostRecentEuropeanEvents = async (req, res) => {
    const queryObj = {
        where: {
            deleted: false,
            status: 'published',
            is_european_event: true
        },
        group: 'organizing_bodies',
        attributes: [
            'organizing_bodies',
            [Sequelize.fn('MAX', Sequelize.col('ends')), 'latest_event']
        ]
    };

    if (req.query.ends) queryObj.where[Sequelize.Op.and] = { ends: { [Sequelize.Op.lte]: moment(req.query.ends, 'YYYY-MM-DD').endOf('day').toDate() } };

    const events = await Event.findAll(queryObj);

    return res.json({
        success: true,
        data: events
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
        attributes: constants.EVENT_PUBLIC_FIELDS,
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

const MAX_ORGANIZERS = 50;

// Whether the user may manage events of all the given types (e.g. the old and the new type).
const canManageTypes = (permissions, types) => types
    .filter(Boolean)
    .every((type) => permissions.manage_event[type] === true);

// Fetches the organizers from core and checks that they are members of one of the
// organizing bodies. Only organizers that aren't in `existingOrganizers` are checked,
// so events created before this rule can still be edited. People who can manage this
// event type may add anyone.
// Only ids, names and comments are stored on the event: anyone can make anyone an
// organizer of an event they create, so contact details must not end up in it.
// Returns { organizers } on success or { error } with a message for the user.
async function resolveOrganizers({ organizers, organizingBodies, existingOrganizers = [], canManage }) {
    const isValidOrganizer = (organizer) => typeof organizer === 'object'
        && organizer !== null
        && Number.isSafeInteger(organizer.user_id)
        && organizer.user_id > 0;
    if (!organizers.every(isValidOrganizer)) {
        return { error: 'Every organizer should have a valid user_id.' };
    }

    const userIds = organizers.map((organizer) => organizer.user_id);
    if (new Set(userIds).size !== userIds.length) {
        return { error: 'Organizers should not be listed twice.' };
    }

    if (organizers.length > MAX_ORGANIZERS) {
        return { error: `An event can have at most ${MAX_ORGANIZERS} organizers.` };
    }

    const adminToken = await core.getAdminToken();
    const fetched = await Promise.all(organizers.map((organizer) => core.fetchUser(organizer, adminToken)));

    if (!canManage) {
        const bodyIds = organizingBodies.map((body) => body.body_id);
        const existingIds = existingOrganizers.map((organizer) => organizer.user_id);
        const outside = fetched.filter((organizer) => !existingIds.includes(organizer.user_id)
            && !organizer.body_ids.some((id) => bodyIds.includes(id)));

        if (outside.length > 0) {
            const ids = outside.map((organizer) => organizer.user_id).join(', ');
            return { error: `Organizers should be members of one of the organizing bodies (user ID ${ids}).` };
        }
    }

    return {
        organizers: fetched.map((organizer) => ({
            user_id: organizer.user_id,
            first_name: organizer.first_name,
            last_name: organizer.last_name,
            ...(typeof organizer.comment === 'string' && { comment: organizer.comment })
        }))
    };
}

// Notification emails of the organizers, fetched with the service account when mailing them.
async function fetchOrganizerEmails(organizers) {
    const adminToken = await core.getAdminToken();
    const fetched = await Promise.all(organizers.map((organizer) => core.fetchUser(organizer, adminToken)));
    return fetched.map((organizer) => organizer.notification_email);
}

const makeOrganizersError = (res, message) => res.status(422).json({
    success: false,
    errors: { organizers: [message] }
});

exports.addEvent = async (req, res) => {
    if (!req.permissions.create_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to create events.');
    }

    // Make sure the user doesn't insert malicious stuff
    const data = req.body;
    delete data.id;
    delete data.image;
    delete data.status;
    delete data.deleted;
    delete data.is_european_event;

    const event = new Event(data);

    // we'll catch these on validation inside the Event model.
    if (Array.isArray(event.organizing_bodies)) {
        event.organizing_bodies = await Promise.all(event.organizing_bodies.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    if (Array.isArray(event.organizers)) {
        if (!event.organizers.some((org) => org.user_id === req.user.id)) {
            return errors.makeForbiddenError(res, 'User creating the event should be the organizers.');
        }

        // Without a valid list of organizing bodies, the Event model validation reports the problem.
        if (Array.isArray(event.organizing_bodies)) {
            const result = await resolveOrganizers({
                organizers: event.organizers,
                organizingBodies: event.organizing_bodies,
                canManage: canManageTypes(req.permissions, [event.type])
            });
            if (result.error) {
                return makeOrganizersError(res, result.error);
            }

            event.organizers = result.organizers;
        }
    }

    await sequelize.transaction(async (t) => {
        // Creating the event in a transaction, so if mail sending fails, the update would be reverted.
        await event.save({ transaction: t });
        const organizerEmails = await fetchOrganizerEmails(event.organizers);

        // Sending the mail to a user.
        await mailer.sendMail({
            to: organizerEmails,
            subject: 'The event was created',
            template: 'events_event_created.html',
            parameters: {
                event
            }
        });

        // Sending SPC information email to organizers.
        await mailer.sendMail({
            to: organizerEmails,
            cc: 'safe.person@aegee.eu',
            reply_to: 'safe.person@aegee.eu',
            subject: 'MyAEGEE: Make your event a safer space',
            template: 'events_spc_info.html',
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
    delete data.image;
    delete data.status;
    delete data.deleted;
    delete data.is_european_event;

    if (Object.keys(data).length === 0) {
        return errors.makeValidationError(res, 'No valid field changes requested');
    }

    if (Array.isArray(data.organizing_bodies)) {
        data.organizing_bodies = await Promise.all(data.organizing_bodies.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    if (Array.isArray(data.organizers)) {
        const result = await resolveOrganizers({
            organizers: data.organizers,
            organizingBodies: Array.isArray(data.organizing_bodies) ? data.organizing_bodies : event.organizing_bodies,
            existingOrganizers: event.organizers,
            // When the type changes, the override needs both the old and the new type.
            canManage: canManageTypes(req.permissions, [event.type, data.type])
        });
        if (result.error) {
            return makeOrganizersError(res, result.error);
        }

        data.organizers = result.organizers;
    }

    await sequelize.transaction(async (t) => {
        // Updating the event in a transaction, so if mail sending fails, the update would be reverted.
        await event.update(data, { transaction: t });

        // Sending the mail to a user.
        await mailer.sendMail({
            to: await fetchOrganizerEmails(event.organizers),
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

        const organizerEmails = await fetchOrganizerEmails(req.event.organizers);

        // Send email to all organizers.
        await mailer.sendMail({
            to: organizerEmails,
            subject: 'Your event\'s status was changed',
            template: 'events_status_changed.html',
            parameters: {
                event: req.event,
                old_status: oldStatus
            }
        });

        if (req.event.status === 'published') {
            await req.event.update({ publication_date: new Date() }, { transaction: t });
        }

        // If the new status is submitted and the old status is draft, send a mail
        // to those who have permissions (EQAC/CD)
        if (oldStatus !== 'draft' || req.event.status !== 'submitted') {
            return;
        }

        await mailer.sendMail({
            to: [
                ...config.new_event_notifications,
                ...(config.new_event_notifications_per_type[req.event.type] || [])
            ],
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

exports.setEuropeanEventStatus = async (req, res) => {
    if (!req.permissions.change_european_event_status[req.event.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to change the European Event status.');
    }

    await sequelize.transaction(async (t) => {
        await req.event.update({ is_european_event: req.body.is_european_event }, { transaction: t });

        if (req.body.is_european_event === false) {
            return;
        }

        const organizerEmails = await fetchOrganizerEmails(req.event.organizers);

        // Send email to all organizers.
        await mailer.sendMail({
            to: organizerEmails,
            subject: 'Your event\'s status was changed',
            template: 'events_european_status_changed.html',
            parameters: {
                event: req.event,
            }
        });
    });

    return res.json({
        success: true,
        message: 'Successfully changed European Event status',
    });
};
