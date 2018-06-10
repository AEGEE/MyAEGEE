const { errors } = require('oms-common-nodejs');

const Event = require('../models/Event');

exports.addEvent = async (req, res) => {
    if (!req.user.permissions.can.create_event[req.body.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to create events of this type.');
    }

    delete req.body.status;

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
    return res.json({
        success: true,
        data: req.event
    });
};

exports.editEvent = async (req, res) => {
    if (!req.user.permissions.can.edit_event[req.event.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to update events of this type.');
    }

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

    if (!req.user.permissions.can.change_event_status[req.event.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status for events of this type.');
    }

    const dbResult = await Event.update({ status: req.body.status }, { where: { id: req.event.id }, returning: true });

    return res.json({
        success: true,
        message: 'Event status was changed successfully.'
    });
};
