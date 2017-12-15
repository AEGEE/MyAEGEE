const restify = require('restify');

const helpers = require('./helpers');
const log = require('./config/logger.js');

const EventType = require('./models/EventType');

const pseudoRoles = require('./config/pseudo');
const eventRoles = require('./config/eventroles');

exports.createLifecycle = async (req, res, next) => {
  const data = req.body;
  delete data._id;

  if (!req.user.permissions.can.edit_lifecycles) {
    return next(helpers.makeForbiddenError('You are not allowed to create/edit lifecycles.'));
  }

  if (!data.eventType) {
    return next(helpers.makeValidationError('No eventType is specified.'));
  }

  try {
    // Validation is specified within the model.
    await EventType.findOneAndUpdate(
      { name: data.eventType },
      { defaultLifecycle: data },
      { upsert: true, runValidators: true } // create lifecycle if not found
    );

    // Everything is saved.
    res.status(201);
    res.json({
      success: true,
      message: 'Lifecycle successfully updated.',
    });

    return next();
  } catch (err) {
    // Send validation-errors back to client
    if (err.name === 'ValidationError') {
      return next(helpers.makeValidationError(err));
    }

    log.error('Could not create/update EventType', err);
    throw err;
  }
};

exports.removeLifecycle = async (req, res, next) => {
  // Errors that can happen there are to be caught in 'uncaughtException' handler.
  if (!req.user.permissions.can.delete_lifecycles) {
    return next(helpers.makeForbiddenError('You are not allowed to delete lifecycles.'));
  }

  if (!req.params.lifecycle_id) {
    return next(helpers.makeValidationError('No lifecycle name was specified.'));
  }

  const doc = await EventType.findOneAndRemove({ name: req.params.lifecycle_id }, {});

  if (!doc) {
    return next(helpers.makeNotFoundError('Lifecycle with that name was not found.'));
  }

  res.json({
    success: true,
    message: `The lifecycle for the event type '${req.params.lifecycle_id}' was successfully deleted.`,
  });
  return next();
};

exports.getLifecyclesNames = async (req, res, next) => {
  const eventTypes = await EventType.find({});
  const names = eventTypes.map(e => e.name);

  res.send({
    success: true,
    data: names
  });
  return next();
};

exports.getPseudoRolesList = async (req, res, next) => {
  const result = pseudoRoles.map(item => ({
    name: item.name,
    description: item.description + ' (event role)'
  }));

  res.json({
    success: true,
    data: result
  });

  return next();
};

exports.getLifecycles = async (req, res, next) => {
  const eventTypes = await EventType.find({})
    .lean(); // To tell Mongoose we just need a plain JS object, so we can modify it.

  res.status(200);
  res.json({
    success: true,
    data: eventTypes,
  });

  return next();
};
