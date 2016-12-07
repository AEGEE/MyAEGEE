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

exports.createLifecycle = (req, res, next) => {
  const data = req.body;
  delete data._id;

  const newLifecycle = new Lifecycle(data);
  newLifecycle.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({ body: err }));
      }

      log.error('Could not create lifecycle', err);
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
};
