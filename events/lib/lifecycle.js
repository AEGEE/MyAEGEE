const restify = require('restify');
const log = require('./config/logger.js');

const EventType = require('./models/EventType');

const pseudoRoles = require('./config/pseudo');
const eventRoles = require('./config/eventroles');

exports.createLifecycle = async (req, res, next) => {
  const data = req.body;
  delete data._id;

  if (!data.eventType) {
    return next(new restify.InvalidArgumentError({ body: {
      success: false,
      message: 'No eventType is specified.'
    } }));
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
      return next(new restify.InvalidArgumentError({
        body: {
          success: false,
          errors: err.errors,
          message: err.message,
        },
      }));
    }

    log.error('Could not create/update EventType', err);
    return next(new restify.InternalError({
      body: {
        success: false,
        message: err.message,
      },
    }));
  }
};

exports.removeLifecycle = async (req, res, next) => {
  if (!req.params.lifecycle_id) {
    return next(new restify.InvalidArgumentError({
      body: {
        success: false,
        message: 'No lifecycle name was specified.',
      },
    }));
  }

  try {
    const doc = await EventType.findOneAndRemove({ name: req.params.lifecycle_id }, {});

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
  } catch (err) {
    return next(new restify.InternalError({
      body: {
        success: false,
        message: err.message,
      },
    }));
  }
};

exports.getLifecyclesNames = async (req, res, next) => {
  try {
    const eventTypes = await EventType.find({});
    const names = eventTypes.map(e => e.name);

    res.send({
      success: true,
      data: names,
    });
    return next();
  } catch (err) {
    return next(new restify.InternalError({
      body: {
        success: false,
        message: err.message,
      },
    }));
  }
};

exports.getPseudoRolesList = async (req, res, next) => {
  const result = eventRoles.roles.map(item => ({
    name: item.name,
    description: item.description + ' (event role)',
  }));

  res.json({
    success: true,
    data: result,
  });

  return next();
};

exports.getLifecycles = async (req, res, next) => {
  try {
    const eventTypes = await EventType.find({})
      .lean(); // To tell Mongoose we just need a plain JS object, so we can modify it.

    res.status(200);
    res.json({
      success: true,
      data: eventTypes,
    });

    return next();
  } catch (err) {
    return next(new restify.InternalError({ body: {
      success: false,
      error: err.message
    } }));
  }
};
