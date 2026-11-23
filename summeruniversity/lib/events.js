const moment = require('moment');
const errors = require('./errors');
const merge = require('./merge');
const constants = require('./constants');
const helpers = require('./helpers');
const { Application, Event, Season } = require('../models');
const { Sequelize, sequelize } = require('./sequelize');
const core = require('./core');
const mailer = require('./mailer');
const config = require('../config');

// Fields that can't be set through the generic event create and edit.
// The application period and the open call have their own endpoints,
// and the participant counters are maintained by the system.
const BLOCKED_EVENT_FIELDS = [
    'id',
    'image',
    'status',
    'deleted',
    'published',
    'application_starts',
    'application_ends',
    'open_call',
    'accepted_participants',
    'available_spots'
];

const removeBlockedFields = (data) => {
    for (const field of BLOCKED_EVENT_FIELDS) {
        delete data[field];
    }
};

exports.listEvents = async (req, res) => {
    // Get default query obj.
    const defaultQueryObj = helpers.getDefaultQuery(req);

    // Applying custom filter: deleted = false, published != none.
    const queryObj = merge(defaultQueryObj, {
        where: {
            deleted: false,
            published: { [Sequelize.Op.not]: 'none' }
        }
    });

    const events = await Event.findAll(queryObj);
    const whitelistEvents = [];

    for (let event of events) {
        if (!req.query.application_status || req.query.application_status.includes(event.application_status)) {
            if (event.published === 'full') {
                event = helpers.whitelistObject(event, constants.EVENT_FULL_FIELDS);
            } else {
                event = helpers.whitelistObject(event, constants.EVENT_MINIMAL_FIELDS);
            }
            whitelistEvents.push(event);
        }
    }

    return res.json({
        success: true,
        data: whitelistEvents,
        meta: {
            offset: queryObj.offset,
            limit: queryObj.limit
        }
    });
};

exports.listMostRecentEvents = async (req, res) => {
    const queryObj = {
        where: {
            deleted: false,
            published: 'full'
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

    // Only visible to board members and admins
    if (!req.permissions.see_boardview.global && !req.permissions.see_boardview[bodyId]) {
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
        attributes: constants.EVENT_MINIMAL_FIELDS, // TODO: check if these fields are enough or too much
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
    const allowedEventTypes = Object.keys(req.permissions.approve_summeruniversity)
        .filter((key) => req.permissions.approve_summeruniversity[key]);

    const events = await Event.findAll({
        where: {
            deleted: false,
            type: { [Sequelize.Op.in]: allowedEventTypes }
        }
    });

    return res.json({
        success: true,
        data: events,
    });
};

const MAX_ORGANIZERS = 50;

// Whether the user may manage Summer Universities of all the given types (e.g. the old and the new type).
const canManageTypes = (permissions, types) => types
    .filter(Boolean)
    .every((type) => permissions.manage_summeruniversity[type] === true);

// The year of the active season, which new events belong to by default.
const getActiveSeasonYear = async () => {
    const season = await Season.findOne({ where: { active: true } });
    return season ? season.year : null;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

// Organizers have to be members of one of the organizing or cooperation bodies.
// Only organizers that aren't in `existingOrganizers` are checked, so events created
// before this rule can still be edited. People who can manage this event type may add anyone.
// Returns an error message for the user, or null if the organizers are fine.
async function checkOrganizers({ organizers, bodies, existingOrganizers = [], canManage }) {
    const isValidOrganizer = (organizer) => typeof organizer === 'object'
        && organizer !== null
        && Number.isSafeInteger(organizer.user_id)
        && organizer.user_id > 0;
    if (!organizers.every(isValidOrganizer)) {
        return 'Every organizer should have a valid user_id.';
    }

    const userIds = organizers.map((organizer) => organizer.user_id);
    if (new Set(userIds).size !== userIds.length) {
        return 'Organizers should not be listed twice.';
    }

    if (organizers.length > MAX_ORGANIZERS) {
        return `A Summer University can have at most ${MAX_ORGANIZERS} organizers.`;
    }

    if (canManage) {
        return null;
    }

    const existingIds = existingOrganizers.map((organizer) => organizer.user_id);
    const newOrganizers = organizers.filter((organizer) => !existingIds.includes(organizer.user_id));
    if (newOrganizers.length === 0) {
        return null;
    }

    const bodyIds = bodies.filter(Boolean).map((body) => body.body_id);
    const adminToken = await core.getAdminToken();
    const fetched = await Promise.all(newOrganizers.map((organizer) => core.fetchUser(organizer, adminToken)));
    const outside = fetched.filter((organizer) => !organizer.body_ids.some((id) => bodyIds.includes(id)));

    if (outside.length === 0) {
        return null;
    }

    const ids = outside.map((organizer) => organizer.user_id).join(', ');
    return `Organizers should be members of one of the organizing or cooperation bodies (user ID ${ids}).`;
}

// The type can only be chosen by holders of edit:su_type: on create, anything but the
// default type, and on edit, any value other than the stored type.
const DEFAULT_TYPE = 'regular';
const changesType = (newType, currentType) => typeof newType !== 'undefined' && newType !== currentType;

// The fee is free for the organizers until the Summer University is submitted. After that,
// changing it needs edit:su_fee. The stored fee is a DECIMAL string, so compare as numbers.
const changesFee = (newFee, currentFee) => typeof newFee !== 'undefined' && Number(newFee) !== Number(currentFee);

// The type and the fee are validated before their permissions are checked, so a value that
// is not valid answers 422 (as the model would) whoever sends it.
const validateTypeAndFee = async (data) => {
    const fields = ['type', 'fee'].filter((field) => typeof data[field] !== 'undefined');
    if (fields.length > 0) {
        await Event.build(Object.fromEntries(fields.map((field) => [field, data[field]]))).validate({ fields });
    }
};

const makeOrganizersError = (res, message) => res.status(422).json({
    success: false,
    errors: { organizers: [message] }
});

exports.addEvent = async (req, res) => {
    if (!req.permissions.create_summeruniversity) {
        return errors.makeForbiddenError(res, 'You are not allowed to create summer university events.');
    }

    // Make sure the user doesn't insert malicious stuff
    const data = req.body;
    removeBlockedFields(data);

    data.status = 'first submission';

    await validateTypeAndFee(data);
    if (changesType(data.type, DEFAULT_TYPE) && !req.permissions.edit_su_type) {
        return errors.makeForbiddenError(res, 'You are not allowed to set the type of this Summer University.');
    }

    const event = new Event(data);

    // Only managers can choose the season, other events get the active one.
    if (!event.season || !canManageTypes(req.permissions, [event.type])) {
        event.season = await getActiveSeasonYear();
    }

    // we'll catch these on validation inside the Event model.
    if (Array.isArray(event.organizers)) {
        if (!event.organizers.some((org) => org.user_id === req.user.id)) {
            return errors.makeForbiddenError(res, 'User creating the event should be one of the organizers.');
        }
    }

    if (Array.isArray(event.organizing_bodies)) {
        event.organizing_bodies = await Promise.all(event.organizing_bodies.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    if (Array.isArray(event.cooperation)) {
        event.cooperation = await Promise.all(event.cooperation.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    if (Array.isArray(event.organizers)) {
        const organizersError = await checkOrganizers({
            organizers: event.organizers,
            bodies: [...asArray(event.organizing_bodies), ...asArray(event.cooperation)],
            canManage: canManageTypes(req.permissions, [event.type])
        });
        if (organizersError) {
            return makeOrganizersError(res, organizersError);
        }
    }

    await sequelize.transaction(async (t) => {
        // Creating the event in a transaction, so if mail sending fails, the update would be reverted.
        await event.save({ transaction: t });

        const adminToken = await core.getAdminToken();
        const organizers = await Promise.all(event.organizers.map((organizer) =>
            core.fetchUser(organizer, adminToken)));

        // Sending the mail to a user.
        await mailer.sendMail({
            to: organizers.map((organizer) => organizer.notification_email),
            subject: 'The event was created',
            template: 'summeruniversity_event_created.html',
            parameters: {
                event
            }
        });

        await mailer.sendMail({
            to: config.new_event_notifications,
            subject: 'A new event was submitted.',
            template: 'summeruniversity_submitted.html',
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
    if (!req.permissions.see_summeruniversity) {
        return errors.makeForbiddenError(res, 'You cannot see this event.');
    }

    let event = req.event.toJSON();

    // Some fields shouldn't be public and only should be displayed to EQAC/CD/admins/organizers.
    if (!helpers.isOrganizer(event, req.user)
        && !req.permissions.manage_summeruniversity[event.type]
        && !req.permissions.approve_summeruniversity[event.type]) {
        if (req.event.published === 'full') {
            event = helpers.whitelistObject(event, constants.EVENT_FULL_FIELDS);
        } else {
            event = helpers.whitelistObject(event, constants.EVENT_MINIMAL_FIELDS);
        }
    }

    return res.json({
        success: true,
        data: event,
        permissions: req.permissions
    });
};

exports.editEvent = async (req, res) => {
    // If user can't edit anything, return error right away
    if (!req.permissions.edit_summeruniversity) {
        return errors.makeForbiddenError(res, 'You cannot edit this event');
    }

    const data = req.body;
    const event = req.event;
    const oldStatus = event.status;

    removeBlockedFields(data);

    // Only managers can change the season.
    if (!data.season || !canManageTypes(req.permissions, [event.type, data.type])) {
        delete data.season;
    }

    if (Object.keys(data).length === 0) {
        return errors.makeValidationError(res, 'No valid field changes requested');
    }

    await validateTypeAndFee(data);
    if (changesType(data.type, event.type) && !req.permissions.edit_su_type) {
        return errors.makeForbiddenError(res, 'You are not allowed to change the type of this Summer University.');
    }

    if (event.status !== 'first draft' && changesFee(data.fee, event.fee) && !req.permissions.edit_su_fee) {
        return errors.makeForbiddenError(res, 'You are not allowed to change the fee of this Summer University.');
    }

    if (Array.isArray(data.organizing_bodies)) {
        data.organizing_bodies = await Promise.all(data.organizing_bodies.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    if (Array.isArray(data.cooperation)) {
        data.cooperation = await Promise.all(data.cooperation.map((body) =>
            core.fetchBody(body, req.headers['x-auth-token'])));
    }

    if (Array.isArray(data.organizers)) {
        const organizingBodies = Array.isArray(data.organizing_bodies) ? data.organizing_bodies : event.organizing_bodies;
        const cooperation = Array.isArray(data.cooperation) ? data.cooperation : event.cooperation;
        const organizersError = await checkOrganizers({
            organizers: data.organizers,
            bodies: [...asArray(organizingBodies), ...asArray(cooperation)],
            existingOrganizers: event.organizers,
            // When the type changes, the override needs both the old and the new type.
            canManage: canManageTypes(req.permissions, [event.type, data.type])
        });
        if (organizersError) {
            return makeOrganizersError(res, organizersError);
        }
    }

    if (oldStatus === 'first draft') {
        data.status = 'first submission';

        if (!req.permissions.change_status[data.status.replace(' ', '_')]) {
            return errors.makeForbiddenError(res, 'You are not allowed to change status.');
        }
    }

    if (['first approval', 'second draft'].includes(oldStatus)) {
        data.status = 'second submission';

        if (!req.permissions.change_status[data.status.replace(' ', '_')]) {
            return errors.makeForbiddenError(res, 'You are not allowed to change status.');
        }
    }

    await sequelize.transaction(async (t) => {
        // Updating the event in a transaction, so if mail sending fails, the update would be reverted.
        await event.update(data, { transaction: t });

        const adminToken = await core.getAdminToken();
        const organizers = Array.isArray(data.organizers) ? data.organizers : event.organizers;
        data.organizers = await Promise.all(organizers.map((organizer) =>
            core.fetchUser(organizer, adminToken)));

        // Sending the mail to a user.
        await mailer.sendMail({
            to: data.organizers.map((organizer) => organizer.notification_email),
            subject: 'The event was updated',
            template: 'summeruniversity_event_updated.html',
            parameters: {
                event
            }
        });

        if (['first draft', 'first approval', 'second draft'].includes(oldStatus)) {
            await mailer.sendMail({
                to: config.new_event_notifications,
                subject: 'A event was submitted.',
                template: 'summeruniversity_submitted.html',
                parameters: {
                    event
                }
            });
        }
    });

    return res.json({
        success: true,
        data: event.toJSON()
    });
};

exports.deleteEvent = async (req, res) => {
    if (!req.permissions.delete_summeruniversity) {
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
    if (!req.permissions.change_status[req.body.status.replace(' ', '_')]) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status.');
    }

    const oldStatus = req.event.status;

    await sequelize.transaction(async (t) => {
        const event = req.event;
        const adminToken = await core.getAdminToken();
        event.organizers = await Promise.all(event.organizers.map((organizer) =>
            core.fetchUser(organizer, adminToken)));

        // Moving back from an approval to the submission stage also unpublishes the event.
        const isRegression = (oldStatus === 'first approval' && req.body.status === 'first submission')
            || (oldStatus === 'second approval' && req.body.status === 'second submission');
        const changes = isRegression
            ? { status: req.body.status, published: 'none' }
            : { status: req.body.status };

        await req.event.update(changes, { transaction: t });

        // Send the mail to all organizers.
        await mailer.sendMail({
            to: event.organizers.map((organizer) => organizer.notification_email),
            subject: 'Your event\'s status was changed',
            template: 'summeruniversity_status_changed.html',
            parameters: {
                event: req.event,
                old_status: oldStatus
            }
        });

        if (['first submission', 'second submission'].includes(req.event.status)) {
            await mailer.sendMail({
                to: config.new_event_notifications,
                subject: 'A new event was submitted.',
                template: 'summeruniversity_submitted.html',
                parameters: {
                    event: req.event
                }
            });
        }
    });

    return res.json({
        success: true,
        message: 'Successfully changed approval status',
    });
};

exports.setPublished = async (req, res) => {
    if (!req.permissions.manage_summeruniversity[req.event.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to set the publication.');
    }

    if (!['none', 'minimal', 'full'].includes(req.body.published)) {
        return errors.makeBadRequestError(res, 'The wanted event publication status is not valid.');
    }

    if (['first draft', 'first submission'].includes(req.event.status) && req.body.published === 'minimal') {
        return errors.makeForbiddenError(res, 'This event status does not allow a minimal publication');
    }

    if (req.event.status !== 'second approval' && req.body.published === 'full') {
        return errors.makeForbiddenError(res, 'This event status does not allow a full publication');
    }

    await req.event.update({ published: req.body.published });

    return res.json({
        success: true,
        message: 'Successfully changed publication status',
    });
};

exports.setApplicationPeriod = async (req, res) => {
    if (!req.permissions.manage_summeruniversity[req.event.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to set the application period.');
    }

    if (req.event.published !== 'full') {
        return errors.makeForbiddenError(res, 'This event status does not allow changing the application period');
    }

    const applicationStarts = typeof req.body.application_starts === 'undefined'
        ? new Date()
        : req.body.application_starts;

    const event = await req.event.update({
        application_starts: applicationStarts,
        application_ends: req.body.application_ends
    });

    return res.json({
        success: true,
        message: 'Successfully changed application period',
        data: event
    });
};

exports.setOpenCallPeriod = async (req, res) => {
    if (!req.permissions.edit_summeruniversity_open_call) {
        return errors.makeForbiddenError(res, 'You are not allowed to change the open call period.');
    }

    if (req.event.published !== 'full') {
        return errors.makeForbiddenError(res, 'This event publication does not allow changing the open call period');
    }

    const acceptedParticipants = await Application.count({ where: {
        event_id: req.event.id,
        status: 'accepted',
        cancelled: false
    } });

    if (req.body.max_participants) {
        req.body = {
            max_participants: req.body.max_participants,
            open_call: req.body.open_call,
            accepted_participants: acceptedParticipants
        };
    } else {
        req.body = { open_call: req.body.open_call };
    }

    await req.event.update(req.body);

    return res.json({
        success: true,
        message: 'Successfully changed open call period',
    });
};
