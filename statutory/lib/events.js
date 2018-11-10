const { errors } = require('oms-common-nodejs');
const { Event } = require('../models');

exports.addEvent = async (req, res) => {
    if (!req.permissions.create_event[req.body.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to create events of this type.');
    }

    delete req.body.status;
    delete req.body.id;

    const newEvent = await Event.create(req.body);
    return res.json({
        success: true,
        data: newEvent
    });
};

exports.listEvents = async (req, res) => {
    const events = await Event.findAll({ where: { status: 'published' } });
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

    const dbResult = await Event.update(req.body, { where: { id: req.event.id }, returning: true });

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

exports.changeEventStatus = async (req, res) => {
    if (!req.body.status) {
        return errors.makeBadRequestError(res, 'New status is not set.');
    }

    if (!req.permissions.change_event_status) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status for events of this type.');
    }

    const dbResult = await Event.update({ status: req.body.status }, { where: { id: req.event.id }, returning: true });

    return res.json({
        success: true,
        message: 'Event status was changed successfully.'
    });
};
