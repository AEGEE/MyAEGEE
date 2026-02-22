const moment = require('moment');
const lodash = require('lodash');

const errors = require('./errors');
const constants = require('./constants');
const helpers = require('./helpers');
const { Sequelize } = require('./sequelize');
const { Event, Image, Application } = require('../models');

function hasManageApplicationPermission(corePermissions, eventType) {
    if (!Array.isArray(corePermissions)) {
        return false;
    }

    return corePermissions.some((permission) => permission.combined.endsWith('manage_applications:' + eventType));
}

exports.addEvent = async (req, res) => {
    if (!req.permissions.create_event[req.body.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to create events of this type.');
    }

    delete req.body.status;
    delete req.body.id;

    if (req.body.type === 'agora') {
        const previousAgora = await Event.findOne({
            where: {
                type: 'agora',
                status: 'published'
            },
            order: [['starts', 'DESC']]
        });

        if (previousAgora) req.body.previous_agora_id = previousAgora.id;
    }

    if (!req.body.application_status_revealed_at
        && req.body.participants_list_publish_deadline
        && moment(req.body.participants_list_publish_deadline).isValid()
        && moment().isSameOrAfter(moment(req.body.participants_list_publish_deadline))) {
        req.body.application_status_revealed_at = new Date();
    }

    const newEvent = await Event.create(req.body);
    return res.json({
        success: true,
        data: newEvent
    });
};

exports.listEvents = async (req, res) => {
    const query = {
        where: { status: 'published' },
        order: [['starts', 'DESC']],
        include: [Image]
    };

    // If search is set, searching for event by name or description case-insensitive.
    if (req.query.search) {
        query.where[Sequelize.Op.or] = [
            { name: { [Sequelize.Op.iLike]: '%' + req.query.search + '%' } },
            { description: { [Sequelize.Op.iLike]: '%' + req.query.search + '%' } }
        ];
    }

    // If event type is set, filter on it.
    if (req.query.type) {
        query.where.type = Array.isArray(req.query.type) ? { [Sequelize.Op.in]: req.query.type } : req.query.type;
    }

    // Filtering by event start and end dates.
    // The events are not inclusive, so when the event starts on 2018-01-02 and ends on 2018-01-17, querying
    // from 2018-01-05 to 2018-01-10 won't return it.
    const dateQuery = [];
    if (req.query.starts) dateQuery.push({ starts: { [Sequelize.Op.gte]: moment(req.query.starts, 'YYYY-MM-DD').startOf('day').toDate() } });
    if (req.query.ends) dateQuery.push({ ends: { [Sequelize.Op.lte]: moment(req.query.ends, 'YYYY-MM-DD').endOf('day').toDate() } });
    query.where[Sequelize.Op.and] = dateQuery;

    const events = await Event.findAll(query);

    return res.json({
        success: true,
        data: events
    });
};

exports.listMostRecentEvents = async (req, res) => {
    const queryObj = {
        where: { status: 'published' },
        group: 'body_id',
        attributes: [
            'body_id',
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

exports.displayEvent = async (req, res) => {
    req.event.permissions = req.permissions;
    const event = req.event.toJSON();
    event.permissions = req.permissions;

    return res.json({
        success: true,
        data: event
    });
};

exports.editEvent = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to update events of this type.');
    }

    delete req.body.type;
    delete req.body.status;
    delete req.body.image_id;
    delete req.body.application_status_revealed_at;

    if (!req.event.application_status_revealed_at
        && req.event.participants_list_publish_deadline
        && moment(req.event.participants_list_publish_deadline).isValid()
        && moment().isSameOrAfter(moment(req.event.participants_list_publish_deadline))) {
        req.body.application_status_revealed_at = new Date();
    }

    const dbResult = await req.event.update(req.body);

    return res.json({
        success: true,
        data: dbResult
    });
};

exports.updateEventImage = async (req, res) => {
    if (!req.permissions.edit_event) {
        await req.image.destroy();
        return errors.makeForbiddenError(res, 'You are not allowed to update events of this type.');
    }

    // removing old image
    if (req.event.image_id) {
        // first updating the event's image to the new one, and then deleting the old one
        // doing it the other way around would violate the foreign key constraint.
        const oldImageId = req.event.image_id;
        await req.event.update({ image_id: req.image.id });
        await Image.destroy({
            where: { id: oldImageId },
            limit: 1,
            individualHooks: true
        });
    } else {
        await req.event.update({ image_id: req.image.id });
    }

    const event = req.event.toJSON();
    event.image = req.image.toJSON();

    return res.json({
        success: true,
        data: event
    });
};

exports.changeEventStatus = async (req, res) => {
    if (!req.body.status) {
        return errors.makeBadRequestError(res, 'New status is not set.');
    }

    if (!req.permissions.change_event_status) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status for events of this type.');
    }

    await req.event.update({ status: req.body.status });

    if (req.event.status === 'published') {
        await req.event.update({ publication_date: new Date() });
    }

    return res.json({
        success: true,
        message: 'Event status was changed successfully.'
    });
};

exports.getApplicationAllFields = async (req, res) => {
    return res.json({
        success: true,
        data: helpers.getApplicationFields(req.event)
    });
};

exports.getApplicationIncomingFields = async (req, res) => {
    const incomingFields = {};
    for (const field of constants.ALLOWED_INCOMING_FIELDS) {
        incomingFields[field] = constants.APPLICATION_FIELD_NAMES[field];
    }

    return res.json({
        success: true,
        data: incomingFields
    });
};

exports.getCandidatesFields = async (req, res) => {
    return res.json({
        success: true,
        data: constants.CANDIDATE_FIELDS
    });
};

exports.listUserAppliedEvents = async (req, res) => {
    const defaultQueryObj = {
        where: {},
        order: [['starts', 'ASC']],
        select: constants.EVENT_PUBLIC_FIELDS
    };

    const queryObj = lodash.merge(defaultQueryObj, {
        where: {
            '$applications.user_id$': req.user.id
        },
        subQuery: false,
        include: [{
            model: Application,
            attributes: ['user_id', 'cancelled', 'status'], // pass along user_id, as well as the status of the application
            required: true
        }]
    });

    const events = await Event.findAll(queryObj);

    for (const event of events) {
        if (!event.applications || event.applications.length === 0) {
            continue;
        }

        if (helpers.shouldHideApplicationStatus(event, {
            manage_applications: hasManageApplicationPermission(req.corePermissions, event.type)
        })) {
            event.applications[0].status = 'pending';
        }
    }

    return res.json({
        success: true,
        data: events,
    });
};
