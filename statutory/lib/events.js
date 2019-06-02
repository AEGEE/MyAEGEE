const errors = require('./errors');
const { Event, Image } = require('../models');

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
    const events = await Event.findAll({
        where: { status: 'published' },
        order: [['starts', 'DESC']],
        include: [Image]
    });
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

    return res.json({
        success: true,
        message: 'Event status was changed successfully.'
    });
};
