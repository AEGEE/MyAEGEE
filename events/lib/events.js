var config = require('./config/config.js');
var log = require('./config/logger.js');
var restify = require('restify');
var helpers = require('./helpers.js');
var mongoose = require('./config/mongo.js');
var imageserv = require('./imageserv.js');
var cron = require('./cron.js');

var Event = require('./eventModel.js');
var lifecycleSchema = require('./lifecycleSchema');
var Lifecycle = lifecycleSchema.Lifecycle;
var EventType = lifecycleSchema.EventType;


// Helper function for determining if two arrays are intersecting or not.
const intersects = (array1, array2) => array1.filter(elt => array2.includes(elt)).length > 0;

/** Requests for all events **/

exports.listEvents = (req, res, next) => {
  // Get statutory, non-statutory and su
  Event
    .where('ends').gte(new Date()) // Only show events in the future
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals.name'].join(' '))
    .populate('status')
    .exec((err, events) => {
      if (err) {
        log.error(err);
        return next(new restify.InternalError());
      }

      // Displaying only events user is allowed to see
      const filteredEvents = events.filter((event) => {
        // TODO: Include bodies
        return event.status.visibility.users.includes(req.user.basic.id.toString())
          || intersects(event.status.visibility.roles, req.user.roles)
          || intersects(event.status.visibility.special, req.user.special);
      });

      res.json(filteredEvents);
      return next();
    });
};

// Returns all events the user is organizer on
exports.listUserOrganizedEvents = (req, res, next) => {
  Event
    // .where('status').ne('deleted') // Hide deleted events
    .where('ends').gte(new Date()) // Only show events in the future
    .elemMatch('organizers', { foreign_id: req.user.basic.id })
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals.name'].join(' '))
    .exec((err, events) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError());
      }

      res.json(events);
      return next();
    });
};

exports.listUserAppliedEvents = function (req, res, next) {
  Event
    .where('status').ne('deleted') // Hide deleted events
    .where('ends').gte(new Date()) // Only show events in the future
    .elemMatch('applications', { foreign_id: req.user.basic.id })
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals'].join(' '))
    .exec(function (err, events) {
      if (err) {
        log.info(err);
        return next(new restify.InternalError());
      }

      res.json(events);
      return next();
    });
};

exports.listApprovableEvents = (req, res, next) => {
  // Loading events and a lifecycle and its statuses for each event.
  Event
    .where('ends').gte(new Date())
    .populate({ path: 'lifecycle', model: 'Lifecycle', populate: { path: 'status', model: 'Status' } })
    .exec((err, events) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError());
      }

      console.log(JSON.stringify(req.user, null, '  '));

      // Checking if we have at least 1 transition
      // from current status to any status
      // which is allowed for this user/body/role/special
      const retVal = events.filter((event) => {
        return event.lifecycle.transitions.some((transition) => {
          // TODO: Add bodies
          return (transition.from.equals(event.status)
            && (transition.allowedFor.users.includes(req.user.basic.id.toString())
              || intersects(transition.allowedFor.roles, req.user.roles)
              || intersects(transition.allowedFor.special, req.user.special)));
        });
      });

      // Return events and their lifecycles.
      res.json(retVal);
      return next();
    });
};

// All event where a local has participated
exports.listLocalInvolvedEvents = function (req, res, next) {
  // Only visible to board members
  if (!req.user.permissions.can.view_local_involved_events)
   return next(new restify.ForbiddenError('You are not allowed to see this'));

  // The first query where mongodb actually has a job
  Event
    .aggregate([
      { $match: { 'applications.antenna_id': String(req.user.basic.antenna_id) } },
      { $unwind: '$applications' },
      { $match: { 'applications.antenna_id': String(req.user.basic.antenna_id) } },
      { $group: {
        _id: '$_id',
        id: { $first: '$_id' },
        name: { $first: '$name' },
        applications: { $push: '$applications' },
      } },
    ])
    .exec(function (err, events) {
      if (err) {
        log.info(err);
        return next(new restify.InternalError());
      }

      res.json({
        success: true,
        events: events,
      });
      return next();
  });
};

exports.addEvent = function (req, res, next) {
  // Make sure the user doesn't insert malicious stuff
  // Fields with other names will be ommitted automatically by mongoose
  var data = req.body;
  delete data._id;
  delete data.status;
  delete data.applications;
  delete data.organizers;
  delete data.application_status;
  // delete data.organizing_locals;

  var newEvent = new Event(data);

  // Creating user automatically becomes organizer
  newEvent.organizers = [
    {
      first_name: req.user.basic.first_name,
      last_name: req.user.basic.last_name,
      foreign_id: req.user.basic.id,
      role: 'full',
      antenna_id: req.user.basic.antenna_id,
      antenna_name: req.user.basic.antenna_name,
      main_organizer: true,
    },
  ];

  // Creating user's local automatically becomes organizing local
  newEvent.organizing_locals = [
    {
      name: req.user.basic.antenna_name,
      foreign_id: req.user.basic.antenna_id,
    },
  ];

  // Loading event type and its default lifecycle
  EventType
    .findOne({ name: data.type })
    .populate({
      path: 'defaultLifecycle',
      populate: { path: 'initialStatus' },
    })
    .then((eventType) => {
      if (!eventType || !eventType.defaultLifecycle) { // no lifecycle exists for this type of event
        return restify.InvalidArgumentError({
          body: `No lifecycle is specified for this type of event: ${data.type},\
cannot set initial status.`,
        });
      }

      newEvent.status = eventType.defaultLifecycle.initialStatus._id;
      newEvent.lifecycle = eventType.defaultLifecycle._id;

      return newEvent.save((err) => {
        if (err) {
          // Send validation-errors back to client
          if (err.name === 'ValidationError') {
            return next(new restify.InvalidArgumentError({ body: err }));
          }

          log.error('Could not edit event', err);
          return next(new restify.InternalError());
        }

        // Setting event status as object, not ID.
        newEvent.status = eventType.defaultLifecycle.initialStatus;

        // Register cronjob for deadline
        if (data.application_deadline) {
          cron.registerDeadline(newEvent.id, newEvent.application_deadline);
        }

        res.status(201);
        res.json({
          success: true,
          message: 'Event successfully created',
          event: newEvent,
        });
        return next();
      });
    });
};

/** Single event **/
exports.eventDetails = function (req, res, next) {

  var event = req.event.toObject();

  delete event.applications;

  res.json(event);
  return next();

};

exports.editEvent = function (req, res, next) {
  // If user can't edit anything, return error right away
  if (!req.user.permissions.can.edit) {
    return next(new restify.ForbiddenError('You cannot edit this event'));
  }

  var data = req.body;
  var event = req.event;
  var registerDeadline = false;
  // Disallow changing applications and organizers, use seperate requests for that
  delete data.applications;
  delete data.organizing_locals;
  delete data.status;

  if (Object.keys(data).length == 0) {
    return next(new restify.InvalidContentError({ message: 'No valid field changes requested' }));
  }

  // Copy fields if user can edit details
  if (req.user.permissions.can.edit_details) {
    // Some properties will be ignored upon empty
    if (data.name) event.name = data.name;
    if (data.starts) event.starts = data.starts;
    if (data.ends) event.ends = data.ends;
    if (data.description) event.description = data.description;
    if (data.type) event.type = data.type;
    if (data.application_fields) event.application_fields = data.application_fields;

    // Others are resettable
    event.max_participants = data.max_participants;
    if (data.fee) event.fee = data.fee;
    event.application_deadline = data.application_deadline;
    var cmp_deadline = new Date(data.application_deadline);
    // Register deadline with cron if changed
    if (data.application_deadline && data.application_deadline > Date.now() &&
     (!event.application_deadline ||  cmp_deadline.getTime() != event.application_deadline.getTime())) {
      registerDeadline = true;
    }

  }

  // Change application status
  if (req.user.permissions.can.edit_application_status) {
    event.application_status = data.application_status;
    event.application_deadline = data.application_deadline;
  }

  if (req.user.permissions.can.edit_organizers && data.organizers) {
    // Loop through organizers, copy data
    data.organizers.forEach(organizer => {
      var index;
      var neworganizer = !event.organizers.some((item, idx) => {
        if (item.foreign_id == organizer.foreign_id) {
          index = idx;
          return true;
        }

        return false;
      });
      // If user already exists, copy only new stuff
      if (!neworganizer) {
        if (organizer.comment) {
          event.organizers[index].comment = organizer.comment;
        }
        if (organizer.main_organizer) {
          event.organizers[index].main_organizer = organizer.main_organizer;
        }
        event.organizers[index].touched = true;
      } else {
        helpers.getUserById(req.header('x-auth-token'), organizer.foreign_id, function (err, res) {
          if (err) {
            log.warn('Could not retrieve user details');
          } else {
            event.organizers.push({
              foreign_id: organizer.foreign_id,
              first_name: res.basic.first_name,
              last_name: res.basic.last_name,
              antenna_id: res.basic.antenna_id,
              antenna_name: res.basic.antenna_name,
              comment: organizer.comment,
              main_organizer: organizer.main_organizer,
              touched: true,
            });
          }
        });
      }
    });

    // Now check if we deleted an organizer (untouched)
    for (var i = event.organizers.length - 1; i >= 0; i--) {
      if (!event.organizers[i].touched)
       event.organizers.splice(i, 1);
    }
  }


  // Try to save
  event.save(function (err) {
    if (err) {
      // Send validation-errors back to client
      if (err.name == 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not edit event', err);
      return next(new restify.InternalError());
    }

    var retval = event.toObject();
    delete retval.applications;
    delete retval.organizers;
    delete retval.__v;
    delete retval.headImg;

    // If deadline was registered, pass that to cron
    if (registerDeadline)
     cron.registerDeadline(event.id, event.application_deadline);

    res.json(retval);
    return next();
  });

};


// This endpoint won't work because of the events lifecycle.
// Two ways to solve this:
// 1) add a 'deleted' field to the Event schema to represent if the event was deleted or not;
// 2) add a 'deleted' status to the lifecycle, if so, this endpoint will be useless.
exports.deleteEvent = function (req, res, next) {
  if (!req.user.permissions.can.delete)
   return next(new restify.ForbiddenError('You are not permitted to delete events'));

  var event = req.event;

  // Deletion is only changing status to deleted
  event.status = 'deleted';
  event.save(function (err) {
    if (err) {
      // Send validation-errors back to client
      if (err.name == 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not delete event', err);
      return next(new restify.InternalError());
    }

    res.json({
      success: true,
      message: 'Event successfully deleted',
    });
    return next();
  });
};

exports.setApprovalStatus = (req, res, next) => {
  // Loading event's lifecycle.
  // Don't need the info about its' statuses,
  // as we care only about transitions info
  // and statuses' ids.
  Lifecycle
    .findById(req.event.lifecycle)
    .then((lifecycle) => {
      // If there is no lifecycle (which can't happen in usual
      // circumstances), raise an error and do nothing.
      if (!lifecycle) {
        return next(restify.InvalidArgumentError({
          body: `No lifecycle is specified for this type of event: ${req.event.type}.`,
        }));
      }

      // Trying to find a transition from event's current status
      // to the required status.
      const transition = lifecycle.transitions.find(t =>
        t.from.equals(req.event.status._id) && t.to.equals(req.body.status));

      // If there is no transition found, it's disallowed to everybody.
      if (!transition) {
        return next(new restify.ForbiddenError());
      }

      // Checking if this user/role/body/special has the rights to do the transition.
      // TODO: Add bodies.

      if (!transition.allowedFor.users.includes(req.user.basic.id.toString())
          && !intersects(transition.allowedFor.roles, req.user.roles)
          && !intersects(transition.allowedFor.special, req.user.special)) {
        return next(new restify.ForbiddenError());
      }

      // We only get here if the user is allowed to do a status transition.
      req.event.status = req.body.status;

      return req.event.save((err) => {
        if (err) {
          // Send validation-errors back to client
          if (err.name === 'ValidationError') {
            return next(new restify.InvalidArgumentError({ body: err }));
          }

          log.error('Could not update event status', err);
          return next(new restify.InternalError());
        }

        res.json({
          success: true,
          message: 'Successfully changed approval status',
        });
        return next();
      });
    });
};

// Just forward the edit rights generated by checkUserRole
exports.getEditRights = function (req, res, next) {
  var retval = req.user.permissions;

  res.json(retval);
  return next();
};

/** Participants **/
exports.listParticipants = function (req, res, next) {
  var event = req.event;
  var status = req.params.status;
  var applications = event.applications.toObject();

  // Only authorized persons can see all applications
  // Others will only see accepted ones and will not see their application text
  if (!req.user.permissions.can.view_applications)
   status = 'accepted';

  for (var i = applications.length - 1; i >= 0; i--) {
    applications[i].url = event.url + '/participants/' + applications[i].foreign_id;
    if (!req.user.permissions.can.approve_participants) {
      delete applications[i].board_comment;
      delete applications[i].application;
    }

    if (status && applications[i].application_status != status) {
      applications.splice(i, 1);
    }
  }

  res.json(applications);
  return next();
};

exports.getApplication = function (req, res, next) {
  var event = req.event;

  // Search for the application
  var application = event.applications.find(element => element.foreign_id === req.user.basic.id);

  if (application == undefined) {
    return next(new restify.ResourceNotFoundError('User ' + req.user.basic.id + ' not found'));
  }

  res.json(application);
  return next();
};

exports.setApplication = (req, res, next) => {
  var event = req.event;

  // Check for permission
  if (!req.user.permissions.can.apply) {
    return next(new restify.ForbiddenError({ message: 'You cannot apply to this event' }));
  }

  // Find the corresponding application
  var index;
  var application = event.applications.find(function (element, idx) {
    if (element.foreign_id == req.user.basic.id) {
      index = idx;
      return true;
    }

    return false;
  });

  // If user hasn't applied yet, create an application
  if (application == undefined) {
    event.applications.push({
      foreign_id: req.user.basic.id,
      first_name: req.user.basic.first_name,
      last_name: req.user.basic.last_name,
      antenna: req.user.basic.antenna_name,
      antenna_id: req.user.basic.antenna_id,
      application: req.body.application,
    });
    index = event.applications.length - 1;
  } else
   event.applications[index].application = req.body.application;


  // Only check the current application for validity, as checking all of them would be too much overhead on big events
  var tmp = helpers.checkApplicationValidity(event.applications[index].application, event.application_fields);
  if (!tmp.passed)
   return next(new restify.InvalidContentError('Application malformed: ' + tmp.msg));

  event.save(function (err) {
    if (err) {
      // Send validation-errors back to client
      if (err.name == 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not save application', err);
      return next(new restify.InternalError());
    }

    res.json({
      success: true,
      message: 'Application saved',
      application: event.applications[index],
    });
    return next();
  });
};

exports.setApplicationStatus = function (req, res, next) {
  // Check user permissions
  if (!req.user.permissions.can.approve_participants) {
    return next(new restify.ForbiddenError('You are not allowed to accept or reject participants'));
  }

  var event = req.event;

  // Find the corresponding application
  var index;
  var application = event.applications.find(function (element, idx) {
    if (element.id == req.params.application_id) {
      index = idx;
      return true;
    }

    return false;
  });

  if (application == undefined) {
    return next(new restify.NotFoundError('Could not find application id ' + req.params.application_id));
  }

  // Save changes
  event.applications[index].application_status = req.body.application_status;

  event.save(function (err) {
    if (err) {
      // Send validation-errors back to client
      if (err.name == 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not set application status', err);
      return next(new restify.InternalError());
    }

    res.json({
      success: true,
      message: 'Application successfully updated',
    });
    return next();
  });
};

exports.setApplicationComment = function (req, res, next) {
  // Check user permissions
  if (!req.user.permissions.can.view_local_involved_events) {
    return next(new restify.ForbiddenError('You are not allowed to put board comments'));
  }

  var event = req.event;

  // Find the corresponding application
  var index;
  var application = event.applications.find(function (element, idx) {
    if (element.id == req.params.application_id) {
      index = idx;
      return true;
    }

    return false;
  });

  if (application == undefined) {
    return next(new restify.NotFoundError('Could not find application id ' + req.params.application_id));
  }

  // Save changes
  event.applications[index].board_comment = req.body.board_comment;

  event.save(function (err) {
    if (err) {
      // Send validation-errors back to client
      if (err.name == 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not set board comment', err);
      return next(new restify.InternalError());
    }

    res.json({
      success: true,
      message: 'Board comment stored',
    });
    return next();
  });
};

/** Organizers **/
/* Not used
exports.listOrganizers = function(req, res, next) {
  var event = req.event;

  var data = event.organizers.toObject();
  data.forEach(function(x, idx) {
   data[idx].url = event.url + '/organizers/' + x.foreign_id;
  });

  res.json(data);
  return next();
}

exports.setOrganizers = function(req, res, next) {
  var event = req.event;

  var data = req.body.organizers;
  if(data.constructor !== Array)
   return next(new restify.InvalidArgumentError('Organizers list must be an array'));
  if(data.length == 0)
   return next(new restify.InvalidArgumentError('Organizers list can not be empty'));


  data.forEach(function(x, idx){
   delete data[idx].cache_first_name;
   delete data[idx].cache_last_name;
   delete data[idx].cache_update;

  });

  event.organizers = data;

  event.save(function(err) {
   if (err) {
     // Send validation-errors back to client
     if(err.name == 'ValidationError') {
      return next(new restify.InvalidArgumentError({body: err}));
     }

     log.error("Could not edit organizers", err);
     return next(new restify.InternalError());
   }

   res.json({
     success: true,
     message: "Successfully saved organizers",
     organizers: event.organizers
   });
   return next();
  });
}*/

// TODO remove. Or maybe not? :D
exports.debug = function (req, res, next) {
  Event.remove({}, function (err) {
    res.send("All events removed, can not be undone. Muhahaha. Wouldn't have guessed this is this serious, wouldn't you?");
    return next();
  });
};

