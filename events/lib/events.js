const { errors } = require('oms-common-nodejs');

const helpers = require('./helpers');
const { Event } = require('../models');
const { Sequelize } = require('./sequelize');

const displayedFields = [
  'name',
  'starts',
  'ends',
  'description',
  'type',
  'status',
  'max_participants',
  'application_status',
  'application_deadline',
  'fee',
]

/** Requests for all events **/

exports.listEvents = async (req, res, next) => {
  const filter = {
    deleted: false, // Filter out deleted events,
    status: 'published'
  };

  if (req.query.type) {
    filter.type = Array.isArray(req.query.type) ? { $in: req.query.type } : req.query.type;
  }

  if (req.query.displayPast === false) {
    filter.starts = { $gte: new Date() };
  }

  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(req.query.search, 'i') },
      { description: new RegExp(req.query.search, 'i') }
    ]
  }

  const events = await Event
    .where(filter)
    .select(displayedFields.join(' '));

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

// All event where a local has participated
exports.listLocalInvolvedEvents = async (req, res, next) => {
  const bodyId = parseInt(req.params.body_id);
  if (Number.isNaN(bodyId)) {
    return errors.makeBadRequestError(res, 'bodyId is not a number.');
  }

  // Only visible to board members
  if (!req.user.permissions.is.board_member_of[bodyId]) {
    return errors.makeForbiddenError(res, 'You are not allowed to see this');
  }

  // The first query where mongodb actually has a job
  const events = await Event
    .aggregate([
      { $unwind: '$applications' },
      { $match: { 'applications.body_id': bodyId } },
      { $project: {
        id: false,
        name: true,
        url: true,
        'application_id': '$applications._id',
        'id': '$_id',
        'user_id': '$applications.user_id',
        'body_id': '$applications.body_id',
        'createdAt': '$applications.createdAt',
        'updatedAt': '$applications.updatedAt',
        'board_comment': '$applications.board_comment',
        'application': '$applications.application',
      }}
    ]);

  return res.json({
    success: true,
    data: events,
  });
};

// Returns all events the user is organizer on
exports.listUserOrganizedEvents = async (req, res, next) => {
  const events = await Event
    .where('deleted').equals(false) // Hide deleted events
    .where('ends').gte(new Date())  // Only show events in the future
    .elemMatch('organizers', { user_id: req.user.id })
    .select(displayedFields.join(' '));

  return res.json({
    success: true,
    data: events,
  });
};

exports.listApprovableEvents = async (req, res, next) => {
  // Loading events and a lifecycle and its statuses for each event.
  const events = await Event
    .where('starts').gte(new Date())
    .where('deleted').equals(false);

  // Checking if we have at least 1 transition
  // from current status to any status
  // which is allowed for this user/body/role/special

  /* eslint-disable arrow-body-style */
  const retVal = events.filter((event) => {
    return event.lifecycle.transitions.some((transition) => {
      // Skipping all transitions without 'from' status,
      // since each event has a status
      if (!transition.from) {
        return false;
      }

      return (transition.from === event.status.name
        && helpers.canUserAccess({ user: req.user, accessObject: transition.allowedFor, event }));
    });
  });

  // Return events and their lifecycles.
  return res.json({
    success: true,
    data: retVal,
  });
};

exports.addEvent = async (req, res, next) => {
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
exports.eventDetails = async (req, res, next) => {
  const event = req.event.toJSON();

  return res.json({
    success: true,
    data: event,
    permissions: req.permissions
  });
};

exports.editEvent = async (req, res, next) => {
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

exports.deleteEvent = async (req, res, next) => {
  if (!req.permissions.delete_event) {
    return errors.makeForbiddenError(res, 'You are not permitted to delete this event.');
  }

  const event = req.event;

  // Deletion is only setting the 'deleted' field to true.
  event.deleted = true;
  await event.save();

  return res.json({
    success: true,
    message: 'Event successfully deleted',
  });
};

exports.setApprovalStatus = async (req, res, next) => {
  // Trying to find a transition from event's current status
  // to the required status.
  const transition = req.event.lifecycle.transitions.find(t =>
    t.from // This field is not necessary, so we need to check if it exists.
    && t.from === req.event.status.name
    && t.to === req.body.status);

  // If there is no transition found, it's disallowed to everybody.
  if (!transition) {
    return errors.makeForbiddenError(res, 'You are not allowed to perform a transition.');
  }

  // Checking if this user/role/body/special has the rights to do the transition.
  if (!helpers.canUserAccess({ user: req.user, accessObject: transition.allowedFor, event: req.event })) {
    return errors.makeForbiddenError(res, 'You are not allowed to perform this transition.');
  }

  // We only get here if the user is allowed to do a status transition.
  req.event.status = req.event.lifecycle.statuses.find(status => status.name === req.body.status);

  await req.event.save();

  return res.json({
    success: true,
    message: 'Successfully changed approval status',
  });
};

// Just forward the edit rights generated by checkUserRole
exports.getEditRights = (req, res, next) => {
  const retval = req.permissions;
  return res.json({
    success: true,
    data: retval
  });
};

/** Organizers **/
exports.addOrganizer = async (req, res, next) => {
  if (!req.permissions.edit_event) {
    return errors.makeForbiddenError(res, 'You are not allowed to edit organizers.');
  }

  const organizer = req.event.organizers.find(org => org.user_id === req.body.user_id);
  if (organizer) {
    return errors.makeBadRequestError(res, 'User with id ' + req.body.user_id + ' is already an organizer.');
  }

  req.event.organizers.push({
    user_id: req.body.user_id,
    comment: req.body.comment,
    roles: req.body.roles
  })

  await req.event.save();

  return res.json({
    success: true,
    message: 'Organizer is added.'
  });
};

exports.editOrganizer = async (req, res, next) => {
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

exports.deleteOrganizer = async (req, res, next) => {
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
exports.addLocal = async (req, res, next) => {
  if (!req.permissions.edit_event) {
    return errors.makeForbiddenError(res, 'You are not allowed to edit organizing locals.');
  }

  const organizer = req.event.organizing_locals.find(org => org.body_id === req.body.body_id);
  if (organizer) {
    return errors.makeBadRequestError(res, 'Body with id ' + req.body.body_id + ' is already an organizing local of this event.');
  }

  req.event.organizing_locals.push({
    body_id: req.body.body_id,
  })

  await req.event.save();

  return res.json({
    success: true,
    message: 'Organizing local is added.'
  });
};

exports.deleteLocal = async (req, res, next) => {
  if (!req.permissions.edit_event) {
    return errors.makeForbiddenError(res, 'You are not allowed to edit organizing locals.');
  }

  const bodyId = parseInt(req.params.body_id, 10);
  if (Number.isNaN(bodyId)) {
    return errors.makeBadRequestError(res, 'bodyId is not a number.');
  }

  const localIndex = req.event.organizing_locals.findIndex(org => org.body_id === bodyId);
  if (localIndex === -1) {
    return errors.makeNotFoundError(res, 'Body with id ' + bodyId + ' is not an organizing local of this event.');
  }

  req.event.organizing_locals.splice(localIndex, 1);

  await req.event.save();

  return res.json({
    success: true,
    message: 'Organizer is deleted.'
  });
};
