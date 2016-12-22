const restify = require('restify');
const log = require('./config/logger.js');
const lifecycleSchema = require('./lifecycleSchema');

const Status = lifecycleSchema.Status;
const Lifecycle = lifecycleSchema.Lifecycle;
const EventType = lifecycleSchema.EventType;

exports.createStatus = (req, res, next) => {
  const data = req.body;
  delete data._id;

  const newStatus = new Status(data);
  newStatus.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not create status', err);
      return next(new restify.InternalError());
    }

    res.status(201);
    res.json({
      success: true,
      message: 'Event successfully created',
      status: newStatus,
    });

    return next();
  });
};

// TODO: refactor this function so it would create statuses,
// save them and store their ID in lifecycle, so we
// won't need the createStatus endpoint.
exports.createLifecycle = (req, res, next) => {
  const data = req.body;
  delete data._id;

  if (!data.eventType) {
    return next(new restify.InvalidArgumentError({ body: 'No event type was specified.' }));
  }

  const newLifecycle = new Lifecycle(data);
  return newLifecycle.save((err, lifecycle) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not create lifecycle', err);
      return next(new restify.InternalError());
    }

    // Getting EventType with this name.
    return EventType
      .findOne({ name: data.eventType })
      .exec((eventTypeFindErr, eventType) => {
        // Handling saving errors.
        if (eventTypeFindErr) {
          return next(new restify.InternalError());
        }

        // If no EventType is specified, we create one.
        if (!eventType) {
          eventType = new EventType({
            name: data.eventType,
          });
        }

        // Setting its default lifecycle to the created one and save.
        eventType.defaultLifecycle = lifecycle._id;
        return eventType.save((eventTypeSaveErr) => {
          if (eventTypeSaveErr) {
            return next(new restify.InternalError());
          }

          res.status(201);
          res.json({
            success: true,
            message: 'Lifecycle successfully created',
            lifecycle: newLifecycle,
          });

          return next();
        });
      });
  });
};

exports.getLifecycles = (req, res, next) => {
  Lifecycle
    .find({})
    .populate([
      'status',
      'initialStatus',
      { path: 'transitions.from', model: 'Status' },
      { path: 'transitions.to', model: 'Status' },
    ])
    .then((lifecycles) => {
      res.status(201);
      res.json({
        success: true,
        lifecycles,
      });

      return next();
    });
};
