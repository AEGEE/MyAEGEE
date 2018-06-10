const { errors } = require('oms-common-nodejs');

const Event = require('../models/Event');

exports.addEvent = async (req, res) => {
    if (!req.user.permissions.can.create_events[req.body.type]) {
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
