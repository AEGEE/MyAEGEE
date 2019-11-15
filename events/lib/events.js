const request = require('request-promise-native');

const errors = require('./errors');
const config = require('../config');
const merge = require('./merge');
const helpers = require('./helpers');
const { Event, Application } = require('../models');
const { Sequelize } = require('./sequelize');

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
            attributes: ['user_id'], // we only need user_id here
            required: true
        }]
    });

    // The subQuery: false line is super important as if we'll remove it,
    // the query fwill fail with `missing FROM-clause entry for table "applications"`
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
            status: 'draft',
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
    delete data.organizers;
    delete data.deleted;

    const newEvent = new Event(data);

    // Creating user automatically becomes organizer
    newEvent.organizers = [
        {
            user_id: req.user.id,
            first_name: req.user.first_name,
            last_name: req.user.last_name
        },
    ];

    await newEvent.save();

    return res.status(201).json({
        success: true,
        message: 'Event successfully created',
        data: newEvent,
    });
};

exports.eventDetails = async (req, res) => {
    const event = req.event.toJSON();

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

    // Disallow changing applications and organizers, use separate requests for that
    delete data.organizers;
    delete data.status;
    delete event.deleted;

    if (Object.keys(data).length === 0) {
        return errors.makeValidationError(res, 'No valid field changes requested');
    }

    await event.update(data);

    const retval = event.toJSON();
    delete retval.applications;
    delete retval.organizers;

    return res.json({
        success: true,
        data: retval
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
    if (!req.permissions.set_status) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status.');
    }

    await req.event.update({ status: req.body.status });

    return res.json({
        success: true,
        message: 'Successfully changed approval status',
    });
};

exports.addOrganizer = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to edit organizers.');
    }

    const organizer = req.event.organizers.find((org) => org.user_id === req.body.user_id);
    if (organizer) {
        return errors.makeBadRequestError(res, 'User with id ' + req.body.user_id + ' is already an organizer.');
    }

    // Fetching the organizer from core.
    const user = await request({
        url: config.core.url + ':' + config.core.port + '/members/' + req.body.user_id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof user !== 'object') {
        throw new Error('Malformed response when fetching user: ' + user);
    }

    if (!user.success) {
        throw new Error('Error fetching user: ' + JSON.stringify(user));
    }

    const organizers = req.event.organizers;
    organizers.push({
        user_id: req.body.user_id,
        comment: req.body.comment,
        first_name: user.data.first_name,
        last_name: user.data.last_name
    });

    await req.event.update({
        organizers
    });

    return res.json({
        success: true,
        message: 'Organizer is added.'
    });
};

exports.editOrganizer = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to edit organizers.');
    }

    const userId = parseInt(req.params.user_id, 10);
    if (Number.isNaN(userId)) {
        return errors.makeBadRequestError(res, 'userId is not a number.');
    }

    const organizer = req.event.organizers.find((org) => org.user_id === userId);
    if (!organizer) {
        return errors.makeNotFoundError(res, 'Organizer with id ' + userId + ' is not found.');
    }
    organizer.comment = req.body.comment;

    await req.event.update({
        organizers: req.event.organizers
    });

    return res.json({
        success: true,
        message: 'Organizer is updated.'
    });
};

exports.deleteOrganizer = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to edit organizers.');
    }

    const userId = parseInt(req.params.user_id, 10);
    if (Number.isNaN(userId)) {
        return errors.makeBadRequestError(res, 'userId is not a number.');
    }

    const organizerIndex = req.event.organizers.findIndex((org) => org.user_id === userId);
    if (organizerIndex === -1) {
        return errors.makeNotFoundError(res, 'Organizer with id ' + userId + ' is not found.');
    }

    const organizers = JSON.parse(JSON.stringify(req.event.organizers));
    organizers.splice(organizerIndex, 1);

    await req.event.update({
        organizers
    });

    return res.json({
        success: true,
        message: 'Organizer is deleted.'
    });
};
