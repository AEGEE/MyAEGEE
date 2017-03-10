const restify = require('restify');
const log = require('./config/logger.js');

const Status = require('./models/Status');
const Lifecycle = require('./models/Lifecycle');
const EventType = require('./models/EventType');

const pseudoRoles = require('./config/pseudo');
const eventRoles = require('./config/eventroles');

exports.createLifecycle = (req, res, next) => {
  const data = req.body;
  delete data._id;

  if (!data.eventType) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No event type was specified.',
      },
    }));
  }

  if (!data.status || data.status.length === 0) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No statuses were specified.',
      },
    }));
  }

  if (!data.initialStatus) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No initial status was specified.',
      },
    }));
  }

  if (!data.transitions || data.transitions.length === 0) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No transitions were specified.',
      },
    }));
  }

  // Checking if there are statuses with the same name.
  const statusesNames = data.status.map(status => status.name);
  if (new Set(statusesNames).size !== statusesNames.length) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'There are many statuses with the same name.',
      },
    }));
  }

  if (!statusesNames.includes(data.initialStatus)) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: `No such status: ${data.initialStatus}.`,
      },
    }));
  }

  for (const transition of data.transitions) {
    if (transition.from && !statusesNames.includes(transition.from)) {
      return next(new restify.InvalidArgumentError({
        body: {
          success: false,
          message: `No such status: ${transition.from}.`,
        },
      }));
    }
    if (!statusesNames.includes(transition.to)) {
      return next(new restify.InvalidArgumentError({
        body: {
          success: false,
          message: `No such status: ${transition.to}.`,
        },
      }));
    }
  }

  const createTransition = data.transitions.find(t =>
    !t.from && t.to === data.initialStatus);

  if (!createTransition) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: `No transition for creating event (null => ${data.initialStatus}) is specified.`,
      },
    }));
  }

  // Removing statuses IDs
  data.status.forEach((status) => { delete status._id; });

  return Status.insertMany(data.status, (statusesSaveError, statuses) => {
    if (statusesSaveError) {
      // Send validation-errors back to client
      if (statusesSaveError.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({
          body: {
            success: false,
            message: statusesSaveError.message,
          },
        }));
      }

      log.error('Could not create statuses', statusesSaveError);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        }
      }));
    }


    // Adding the new statuses' IDs into the new lifecycle.
    data.initialStatus = statuses.find(s => s.name === data.initialStatus)._id;
    for (const transition of data.transitions) {
      if (transition.from) {
        transition.from = statuses.find(s => s.name === transition.from)._id;
      } else {
        transition.from = null;
      }
      transition.to = statuses.find(s => s.name === transition.to)._id;
    }
    data.status = statuses.map(s => s._id);

    // Statuses are saved, now creating new lifecycle.
    const newLifecycle = new Lifecycle(data);

    return newLifecycle.save((lifecycleSaveError, lifecycle) => {
      if (lifecycleSaveError) {
        // Send validation-errors back to client
        if (lifecycleSaveError.name === 'ValidationError') {
          return next(new restify.InvalidArgumentError({
            body: {
              success: false,
              errors: lifecycleSaveError.errors,
              message: lifecycleSaveError.message,
            },
          }));
        }

        log.error('Could not create lifecycle', lifecycleSaveError);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: err.message,
          },
        }));
      }

      // Lifecycle saved, now updating (or creating) the EventType.

      return EventType.findOneAndUpdate({
        name: data.eventType,
      }, {
        defaultLifecycle: lifecycle._id,
      }, {
        upsert: true, // create lifecycle if not found
      }, (eventTypeSaveError) => {
        if (eventTypeSaveError) {
          // Send validation-errors back to client
          if (eventTypeSaveError.name === 'ValidationError') {
            return next(new restify.InvalidArgumentError({
              body: {
                success: false,
                message: eventTypeSaveError.message,
              },
            }));
          }

          log.error('Could not create/update EventType', eventTypeSaveError);
          return next(new restify.InternalError({
            body: {
              success: false,
              message: eventTypeSaveError.message,
            },
          }));
        }

        // Everything is saved.
        res.status(201);
        res.json({
          success: true,
          message: 'Lifecycle successfully updated.',
        });

        return next();
      });
    });
  });
};

// TODO: Remove statuses
exports.removeLifecycle = (req, res, next) => {
  if (!req.params.lifecycle_id) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No lifecycle name was specified.',
      },
    }));
  }

  return EventType
    .findOneAndRemove({ name: req.params.lifecycle_id }, {})
    .then((doc) => {
      if (!doc) {
        return next(new restify.InternalError({
          body: {
            success: false,
            message: 'Lifecycle with that name was not found.',
          },
        }));
      }

      res.json({
        success: true,
        message: `The lifecycle for the event type '${req.params.lifecycle_id}' was successfully deleted.`,
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

exports.getLifecyclesNames = (req, res, next) => {
  EventType
    .find({})
    .then((eventTypes) => {
      const names = eventTypes.map(e => e.name);

      res.send({
        success: true,
        data: names,
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

exports.getPseudoRolesList = (req, res, next) => {
  var result = pseudoRoles;
  eventRoles.roles.forEach((item) => {
    result.push({
      name: item.name,
      description: item.description + ' (event role)',
    });
  });

  res.json({
    success: true,
    data: result,
  });

  return next();
};

exports.getLifecycles = (req, res, next) => {
  EventType
    .find({})
    .populate({
      path: 'defaultLifecycle',
      model: 'Lifecycle',
      populate: ['status'],
    })
    .lean() // To tell Mongoose we just need a plain JS object, so we can modify it.
    .then((eventTypes) => {
      // Replacing IDs with names for initial statuses and transitions' statuses.
      for (const eventType of eventTypes) {
        const lifecycle = eventType.defaultLifecycle;

        eventType.defaultLifecycle.initialStatus = lifecycle.status.find(s =>
          s._id.equals(lifecycle.initialStatus)).name;

        for (const transition of lifecycle.transitions) {
          if (transition.from) {
            transition.from = lifecycle.status.find(s => s._id.equals(transition.from)).name;
          } else {
            transition.from = null;
          }
          transition.to = lifecycle.status.find(s => s._id.equals(transition.to)).name;
        }
      }

      res.status(200);
      res.json({
        success: true,
        data: eventTypes,
      });

      return next();
    });
};
