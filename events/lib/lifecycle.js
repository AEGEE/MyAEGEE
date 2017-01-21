const restify = require('restify');
const log = require('./config/logger.js');

const Status = require('./models/Status');
const Lifecycle = require('./models/Lifecycle');
const EventType = require('./models/EventType');

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
    if (!statusesNames.includes(transition.from)) {
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
      return next(new restify.InternalError());
    }


    // Adding the new statuses' IDs into the new lifecycle.
    data.initialStatus = statuses.find(s => s.name === data.initialStatus)._id;
    for (const transition of data.transitions) {
      transition.from = statuses.find(s => s.name === transition.from)._id;
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
              message: lifecycleSaveError.message,
            },
          }));
        }

        log.error('Could not create lifecycle', lifecycleSaveError);
        return next(new restify.InternalError());
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
          return next(new restify.InternalError());
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
          transition.from = lifecycle.status.find(s => s._id.equals(transition.from)).name;
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
