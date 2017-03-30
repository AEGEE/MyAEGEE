const restify = require('restify');

const log = require('./config/logger.js');
const eventRoles = require('./config/eventroles');
const helpers = require('./helpers.js');
const cron = require('./cron.js');
const user = require('./user.js');
const Event = require('./models/Event');
const Lifecycle = require('./models/Lifecycle');
const EventType = require('./models/EventType');


// Helper function for determining if two arrays are intersecting or not.
const intersects = (array1, array2) => array1.filter(elt => array2.includes(elt)).length > 0;

/** Requests for all events **/

exports.listEvents = (req, res, next) => {
  Event
    .where('ends').gte(new Date())  // Only show events in the future
    .where('deleted').equals(false) // Filter out deleted events
    .select([
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
      'organizing_locals.name',
    ].join(' '))
    .populate('status')
    .exec((err, events) => {
      if (err) {
        log.error(err);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: err.message,
          },
        }));
      }

      // Displaying only events user is allowed to see
      const filteredEvents = events.filter((event) => {
        // TODO: Include bodies
        return event.status.visibility.users.includes(req.user.basic.id.toString())
          || intersects(event.status.visibility.roles, req.user.roles)
          || intersects(event.status.visibility.special, req.user.special);
      });

      res.json({
        success: true,
        data: filteredEvents,
      });
      return next();
    });
};

// Returns all events the user is organizer on
exports.listUserOrganizedEvents = (req, res, next) => {
  Event
    .where('deleted').equals(false) // Hide deleted events
    .where('ends').gte(new Date())  // Only show events in the future
    .elemMatch('organizers', { foreign_id: req.user.basic.id })
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals.name'].join(' '))
    .exec((err, events) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: err.message,
          },
        }));
      }

      res.json({
        success: true,
        data: events,
      });
      return next();
    });
};

exports.listApprovableEvents = (req, res, next) => {
  // Loading events and a lifecycle and its statuses for each event.
  Event
    .where('ends').gte(new Date())
    .where('deleted').equals(false)
    .populate({ path: 'lifecycle', model: 'Lifecycle', populate: { path: 'status', model: 'Status' } })
    .exec((err, events) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: err.message,
          },
        }));
      }

      // Checking if we have at least 1 transition
      // from current status to any status
      // which is allowed for this user/body/role/special
      const retVal = events.filter((event) => {
        var permissions = helpers.getEventPermissions(event, req.user);

        return event.lifecycle.transitions.some((transition) => {
          // Skipping all transitions without 'from' status,
          // since each event has a status
          if (!transition.from) {
            return false;
          }

          // TODO: Add bodies
          return (transition.from.equals(event.status)
            && (transition.allowedFor.users.includes(req.user.basic.id.toString())
              || intersects(transition.allowedFor.roles, req.user.roles)
              || intersects(transition.allowedFor.special, req.user.special)
              || intersects(transition.allowedFor.special, permissions.special)));
        });
      });

      // Return events and their lifecycles.
      res.json({
        success: true,
        data: retVal,
      });
      return next();
    });
};

// All event where a local has participated
exports.listLocalInvolvedEvents = (req, res, next) => {
  // Only visible to board members
  if (!req.user.permissions.can.view_local_involved_events) {
    return next(new restify.ForbiddenError('You are not allowed to see this'));
  }

  // The first query where mongodb actually has a job
  return Event
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
    .exec((err, events) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: err.message,
          },
        }));
      }

      res.json({
        success: true,
        data: events,
      });
      return next();
    });
};

exports.addEvent = (req, res, next) => {
  // Make sure the user doesn't insert malicious stuff
  // Fields with other names will be ommitted automatically by mongoose
  const data = req.body;
  delete data._id;
  delete data.status;
  delete data.applications;
  delete data.organizers;
  delete data.application_status;
  // delete data.organizing_locals;

  if (!data.type) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No event type is specified.',
      },
    }));
  }

  const newEvent = new Event(data);

  const organizerAccess = { users: [], bodies: [], roles: [], special: ['Organizer'] };
  const publicAccess = { users: [], bodies: [], roles: [], special: ['Public'] };

  // Adding default links to the event.
  newEvent.links = [
    { controller: 'app.events.apply', displayName: 'Apply to event', visibility: publicAccess },
    { controller: 'app.eventadmin.edit', displayName: 'Edit event', visibility: organizerAccess },
    { controller: 'app.eventadmin.approve_participants', displayName: 'Approve participants', visibility: organizerAccess },
    { controller: 'app.events.organizers', displayName: 'See organizers', visibility: publicAccess },
    { controller: 'app.events.participants', displayName: 'See participants', visibility: publicAccess },
  ];

  // Get the default role to assign to the user
  user.getDefaultEventRoles((defaultRoles) => {
    // Creating user automatically becomes organizer
    newEvent.organizers = [
      {
        foreign_id: req.user.basic.id,
        roles: defaultRoles,
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
      .findOne({ name: newEvent.type })
      .populate({
        path: 'defaultLifecycle',
        populate: { path: 'initialStatus' },
      })
      .then((eventType) => {
        if (!eventType || !eventType.defaultLifecycle) {
          // no lifecycle exists for this type of event
          return next(new restify.InvalidArgumentError({
            body: {
              success: false,
              message: `No lifecycle is specified for this type of event: ${newEvent.type}, \
cannot set initial status.`,
            },
          }));
        }

        // Checking if the user is allowed to create an event.
        // Trying to find a transition from 'null' to 'initialStatus'
        const transition = eventType.defaultLifecycle.transitions.find(t =>
          !t.from && t.to.equals(eventType.defaultLifecycle.initialStatus._id));

        if (!transition) {
          return next(new restify.InvalidArgumentError({
            body: {
              success: false,
              message: 'Nobody is allowed to create events of this type.',
            },
          }));
        }

        // Checking if the user is allowed to create events of this type.
        // TODO: Add bodies support.
        if (!transition.allowedFor.users.includes(req.user.basic.id.toString())
            && !intersects(transition.allowedFor.roles, req.user.roles)
            && !intersects(transition.allowedFor.special, req.user.special)) {
          return next(new restify.ForbiddenError({
            body: {
              success: false,
              message: 'You are not allowed to create an event of this type.',
            },
          }));
        }

        // Now we've got here, the user is allowed to create the event.
        newEvent.status = eventType.defaultLifecycle.initialStatus._id;
        newEvent.lifecycle = eventType.defaultLifecycle._id;

        return newEvent.save((err) => {
          if (err) {
            // Send validation-errors back to client
            if (err.name === 'ValidationError') {
              return next(new restify.InvalidArgumentError({
                body: {
                  success: false,
                  errors: err.errors,
                  message: err.message,
                },
              }));
            }

            log.error('Could not add event', err);
            return next(new restify.InternalError({
              body: {
                success: false,
                message: err.message,
              },
            }));
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
            data: [newEvent],
          });
          return next();
        });
      });
  });
};

/** Single event **/
exports.eventDetails = (req, res, next) => {
  const event = req.event.toObject();

  delete event.applications;
  // Populate organizers
  const transformUserData = (u) => {
    return {
      first_name: u.basic.first_name,
      last_name: u.basic.last_name,
      antenna_name: u.basic.antenna_name,
    };
  };

  user.populateUsers(event.organizers, req.headers['x-auth-token'], (organizers) => {
    event.organizers = organizers;

    res.json({
      success: true,
      data: event,
      permissions: req.user.permissions,
      special: req.user.special,
    });
    return next();
  }, transformUserData);
};

exports.editEvent = (req, res, next) => {
  // If user can't edit anything, return error right away
  if (!req.user.permissions.can.edit) {
    return next(new restify.ForbiddenError('You cannot edit this event'));
  }

  const data = req.body;
  const event = req.event;
  let registerDeadline = false;
  // Disallow changing applications and organizers, use seperate requests for that
  delete data.applications;
  delete data.organizing_locals;
  delete data.status;

  if (Object.keys(data).length === 0) {
    return next(new restify.InvalidContentError({ message: 'No valid field changes requested' }));
  }

  // Copy fields if user can edit details
  if (req.user.permissions.can.edit_details) {
    // Some properties will be ignored upon empty
    if (data.name) event.name = data.name;
    if (data.starts) event.starts = data.starts;
    if (data.ends) event.ends = data.ends;
    if (data.url) event.url = data.url;
    if (data.description) event.description = data.description;
    if (data.application_fields) event.application_fields = data.application_fields;

    // Others are resettable
    event.max_participants = data.max_participants;
    if (data.fee) event.fee = data.fee;
    event.application_deadline = data.application_deadline;
    const cmpDeadline = new Date(data.application_deadline);

    // Register deadline with cron if changed
    if (data.application_deadline && data.application_deadline > Date.now() &&
     (!event.application_deadline
      || cmpDeadline.getTime() !== event.application_deadline.getTime())) {
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
    data.organizers.forEach((organizer) => {
      // Change the roles to only hold ids
      if (organizer.roles) {
        organizer.roles = organizer.roles.map((role) => {
          if (role.id)
            return role.id;
          return role;
        });
      }

      // Try to find organizer in list
      let index = event.organizers.findIndex((item) => item.foreign_id === organizer.foreign_id);

      // If user already exists, copy only new stuff
      if (index !== undefined && index !== -1) {
        if (organizer.comment) { event.organizers[index].comment = organizer.comment; } // Comment not resettable
        // Roles resettable, but only store ids
        if (organizer.roles) {
          event.organizers[index].roles = organizer.roles;
        }

        // Mark as touched
        event.organizers[index].touched = true;
      } else {
        event.organizers.push({
          foreign_id: organizer.foreign_id,
          comment: organizer.comment,
          roles: organizer.roles,
          touched: true,
        });
      }
    });

    // Now check if we deleted an organizer (untouched)
    for (let i = event.organizers.length - 1; i >= 0; i--) {
      if (!event.organizers[i].touched) {
        event.organizers.splice(i, 1);
      }
    }
  }


  // Try to save
  return event.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not edit event', err);
      return next(new restify.InternalError());
    }

    const retval = event.toObject();
    delete retval.applications;
    delete retval.organizers;
    delete retval.__v;
    delete retval.headImg;

    // If deadline was registered, pass that to cron
    if (registerDeadline) {
      cron.registerDeadline(event.id, event.application_deadline);
    }

    res.json({
      success: true,
      data: retval,
    });
    return next();
  });
};

exports.deleteEvent = (req, res, next) => {
  if (!req.user.permissions.can.delete) {
    return next(new restify.ForbiddenError({
      body: {
        success: false,
        message: 'You are not permitted to delete events',
      },
    }));
  }

  const event = req.event;

  // Deletion is only setting the 'deleted' field to true.
  event.deleted = true;
  return event.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({
          body: {
            success: false,
            errors: [err.errors],
            message: err.message,
          },
        }));
      }

      log.error('Could not delete event', err);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        },
      }));
    }

    res.json({
      success: true,
      message: 'Event successfully deleted',
    });
    return next();
  });
};

exports.listPossibleStatuses = (req, res, next) => {
  Lifecycle
    .findById(req.event.lifecycle)
    .populate('status')
    .then((lifecycle) => {
      // If there is no lifecycle (which can't happen in usual
      // circumstances), raise an error and do nothing.
      if (!lifecycle) {
        return next(restify.InvalidArgumentError({
          body: {
            success: false,
            message: `No lifecycle is specified for this type of event: ${req.event.type}.`,
          },
        }));
      }

      const possibleTransitions = lifecycle.transitions.filter((transition) => {
        // Skipping all transitions without 'from' status,
        // since each event has a status
        if (!transition.from) {
          return false;
        }

        // TODO: Add bodies
        return (transition.from.equals(req.event.status._id)
          && (transition.allowedFor.users.includes(req.user.basic.id.toString())
            || intersects(transition.allowedFor.roles, req.user.roles)
            || intersects(transition.allowedFor.special, req.user.special)));
      });

      // Appending statuses, so we won't have to load them manually.
      possibleTransitions.forEach((t) => {
        t.from = lifecycle.status.find(s => s._id.equals(t.from));
        t.to = lifecycle.status.find(s => s._id.equals(t.to));
      });

      res.send({
        success: true,
        data: possibleTransitions,
      });
      return next();
    })
    .catch(err => next(new restify.InternalError({
      body: {
        success: false,
        message: err.message,
      },
    })));
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
          body: {
            success: false,
            message: `No lifecycle is specified for this type of event: ${req.event.type}.`,
          },
        }));
      }

      // Trying to find a transition from event's current status
      // to the required status.
      const transition = lifecycle.transitions.find(t =>
        t.from // This field is not necessary
        && t.from.equals(req.event.status._id)
        && t.to.equals(req.body.status));

      // If there is no transition found, it's disallowed to everybody.
      if (!transition) {
        return next(new restify.ForbiddenError({
          body: {
            success: false,
            message: 'You are not allowed to perform a transition.',
          },
        }));
      }

      // Checking if this user/role/body/special has the rights to do the transition.
      // TODO: Add bodies.
      if (!transition.allowedFor.users.includes(req.user.basic.id.toString())
          && !intersects(transition.allowedFor.roles, req.user.roles)
          && !intersects(transition.allowedFor.special, req.user.special)) {
        return next(new restify.ForbiddenError({
          body: {
            success: false,
            message: 'You are not allowed to perform this transition.',
          },
        }));
      }

      // We only get here if the user is allowed to do a status transition.
      req.event.status = req.body.status;

      return req.event.save((err) => {
        if (err) {
          // Send validation-errors back to client
          if (err.name === 'ValidationError') {
            return next(new restify.InvalidArgumentError({
              body: {
                success: false,
                errors: err.errors,
                message: err.message,
              },
            }));
          }

          log.error('Could not update event status', err);
          return next(new restify.InternalError({
            body: {
              success: false,
              message: err.message,
            },
          }));
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
exports.getEditRights = (req, res, next) => {
  const retval = req.user.permissions;
  retval.special = req.user.special;
  res.json({
    success: true,
    data: [retval],
  });
  return next();
};

exports.addEventLink = (req, res, next) => {
  if (!req.body.controller || !req.body.displayName) {
    return next(new restify.InvalidArgumentError({ body: {
      success: false,
      message: 'Malformed request.',
    } }));
  }

  // Adding link to event and saving it.
  req.event.links.push(req.body);
  return req.event.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({
          body: {
            success: false,
            errors: err.errors,
            message: err.message,
          },
        }));
      }

      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        },
      }));
    }

    res.json({
      success: true,
      message: 'Link added.',
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
exports.debug = (req, res, next) => {
  Event.remove({}, () => {
    res.send('All events removed, can not be undone. Muhahaha. Wouldn\'t have guessed this is this serious, wouldn\'t you?');
    return next();
  });
};

