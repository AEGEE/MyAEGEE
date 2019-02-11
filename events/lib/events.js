const errors = require('./errors');
const helpers = require('./helpers');
const { Event, Application } = require('../models');
const { Sequelize } = require('./sequelize');

/** Requests for all events **/

exports.listEvents = async (req, res) => {
    const filter = {
        deleted: false, // Filter out deleted events,
        status: 'published'
    };

    if (req.query.type) {
        filter.type = Array.isArray(req.query.type) ? { [Sequelize.Op.in]: req.query.type } : req.query.type;
    }

    if (req.query.displayPast === false) {
        filter.starts = { [Sequelize.Op.gte]: new Date() };
    }

    if (req.query.search) {
        filter[Sequelize.Op.or] = [
            { name: { [Sequelize.Op.iLike]: '%' + req.query.search + '%' } },
            { description: { [Sequelize.Op.iLike]: '%' + req.query.search + '%' } }
        ];
    }

    const events = await Event.findAll({ where: filter });

    let queryOffset = 0;
    let queryLimit = events.length;

    if (req.query.offset) {
        const offset = parseInt(req.query.offset, 10);
        if (!Number.isNaN(offset) && offset >= 0) {
            queryOffset = offset;
        }
    }

    if (req.query.limit) {
        const limit = parseInt(req.query.limit, 10);
        if (!Number.isNaN(limit) && limit > 0) {
            queryLimit = limit;
        }
    }

    const eventsWithOffsetAndLimit = events.slice(queryOffset, queryOffset + queryLimit);

    return res.json({
        success: true,
        data: eventsWithOffsetAndLimit,
        meta: {
            offset: queryOffset,
            limit: queryLimit,
            moreAvailable: (queryOffset + queryLimit) < events.length
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
    const events = await Event.findAll({ where: { deleted: false } });

    const filteredEvents = events.filter(event => event.organizers.some(org => org.user_id === req.user.id));

    return res.json({
        success: true,
        data: filteredEvents,
    });
};

exports.listApprovableEvents = async (req, res) => {
    const allowedEventTypes = Object.keys(req.permissions.approve_event)
    .filter(key => req.permissions.approve_event[key]);

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
  // Fields with other names will be ommitted automatically by mongoose
    const data = req.body;
    delete data._id;
    delete data.status;
    delete data.organizers;
    delete data.applications;
    delete data.application_status;
    delete data.organizing_locals;
    delete data.deleted;

    if (!data.type) {
        return errors.makeValidationError(res, 'No event type is specified.');
    }

    const newEvent = new Event(data);

  // Creating user automatically becomes organizer
    newEvent.organizers = [
        {
            user_id: req.user.id,
            first_name: req.user.first_name,
            last_name: req.user.last_name
        },
    ];

  // Checking if the user IS the member of the body.
    if (!data.body_id || !helpers.isMemberOf(req.user, data.body_id)) {
        return errors.makeForbiddenError(res, 'You are not a member of this body and cannot create an event on behalf of it.');
    }
    newEvent.organizing_bodies = [{ body_id: data.body_id }];

    await newEvent.save();

    return res.status(201).json({
        success: true,
        message: 'Event successfully created',
        data: newEvent,
    });
};

/** Single event **/
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
    delete data.applications;
    delete data.organizing_locals;
    delete data.organizers;
    delete data.status;

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
  // If there is no transition found, it's disallowed to everybody.
    if (!req.permissions.set_status) {
        return errors.makeForbiddenError(res, 'You are not allowed to change status.');
    }

    await req.event.update({ status: req.body.status });

    return res.json({
        success: true,
        message: 'Successfully changed approval status',
    });
};

// Just forward the edit rights generated by checkUserRole
exports.getEditRights = (req, res) => {
    const retval = req.permissions;
    return res.json({
        success: true,
        data: retval
    });
};

/** Organizers **/
exports.addOrganizer = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to edit organizers.');
    }

    const organizer = req.event.organizers.find(org => org.user_id === req.body.user_id);
    if (organizer) {
        return errors.makeBadRequestError(res, 'User with id ' + req.body.user_id + ' is already an organizer.');
    }

    req.event.organizers.push({
        user_id: req.body.user_id,
        comment: req.body.comment
    });

    await req.event.save();

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

    const organizer = req.event.organizers.find(org => org.user_id === userId);
    if (!organizer) {
        return errors.makeNotFoundError(res, 'Organizer with id ' + userId + ' is not found.');
    }

    if (req.body.comment) organizer.comment = req.body.comment;
    if (req.body.roles) organizer.roles = req.body.roles;

    await req.event.save();

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

    const organizerIndex = req.event.organizers.findIndex(org => org.user_id === userId);
    if (organizerIndex === -1) {
        return errors.makeNotFoundError(res, 'Organizer with id ' + userId + ' is not found.');
    }

    req.event.organizers.splice(organizerIndex, 1);

    await req.event.save();

    return res.json({
        success: true,
        message: 'Organizer is deleted.'
    });
};

/** Locals **/
exports.addLocal = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to edit organizing bodies.');
    }

    const organizer = req.event.organizing_bodies.find(org => org.body_id === req.body.body_id);
    if (organizer) {
        return errors.makeBadRequestError(res, 'Body with id ' + req.body.body_id + ' is already an organizing body of this event.');
    }

    const newBodies = req.event.organizing_bodies;
    newBodies.push({
        body_id: req.body.body_id,
    });

    await req.event.update({ organizing_bodies: newBodies });

    return res.json({
        success: true,
        message: 'Organizing local is added.'
    });
};

exports.deleteLocal = async (req, res) => {
    if (!req.permissions.edit_event) {
        return errors.makeForbiddenError(res, 'You are not allowed to edit organizing locals.');
    }

    const bodyId = parseInt(req.params.body_id, 10);
    if (Number.isNaN(bodyId)) {
        return errors.makeBadRequestError(res, 'bodyId is not a number.');
    }

    const localIndex = req.event.organizing_bodies.findIndex(org => org.body_id === bodyId);
    if (localIndex === -1) {
        return errors.makeNotFoundError(res, 'Body with id ' + bodyId + ' is not an organizing local of this event.');
    }

    const newBodies = req.event.organizing_bodies;
    newBodies.splice(localIndex, 1);

    await req.event.update({ organizing_bodies: newBodies });

    return res.json({
        success: true,
        message: 'Organizer is deleted.'
    });
};
