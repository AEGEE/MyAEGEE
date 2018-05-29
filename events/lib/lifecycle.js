const helpers = require('./helpers');
const log = require('./config/logger.js');
const EventType = require('./models/EventType');
const pseudoRoles = require('./config/pseudo');
const seed = require('../scripts/seed');

exports.createLifecycle = async (req, res, next) => {
  const data = req.body;
  delete data._id;

  if (!req.user.permissions.can.edit_lifecycles) {
    return helpers.makeForbiddenError(res, 'You are not allowed to create/edit lifecycles.');
  }

  if (!data.eventType) {
    return helpers.makeValidationError(res, 'No eventType is specified.');
  }

  try {
    // Validation is specified within the model.
    await EventType.findOneAndUpdate(
      { name: data.eventType },
      { defaultLifecycle: data },
      { upsert: true, runValidators: true } // create lifecycle if not found
    );

    // Everything is saved.
    return res.status(201).json({
      success: true,
      message: 'Lifecycle successfully updated.',
    });
  } catch (err) {
    // Send validation-errors back to client
    if (err.name === 'ValidationError') {
      return helpers.makeValidationError(res, err);
    }

    log.error('Could not create/update EventType', err);
    throw err;
  }
};

exports.removeLifecycle = async (req, res, next) => {
  // Errors that can happen there are to be caught in 'uncaughtException' handler.
  if (!req.user.permissions.can.delete_lifecycles) {
    return helpers.makeForbiddenError(res, 'You are not allowed to delete lifecycles.');
  }

  if (!req.params.lifecycle_id) {
    return helpers.makeValidationError(res, 'No lifecycle name was specified.');
  }

  const doc = await EventType.findOneAndRemove({ name: req.params.lifecycle_id }, {});

  if (!doc) {
    return helpers.makeNotFoundError(res, 'Lifecycle with that name was not found.');
  }

  return res.json({
    success: true,
    message: `The lifecycle for the event type '${req.params.lifecycle_id}' was successfully deleted.`,
  });
};

exports.getLifecyclesNames = async (req, res, next) => {
  const eventTypes = await EventType.find({});
  const names = eventTypes.map(e => e.name);

  return res.json({
    success: true,
    data: names
  });
};

exports.getPseudoRolesList = async (req, res, next) => {
  const result = pseudoRoles.map(item => ({
    name: item.name,
    description: item.description + ' (event role)'
  }));

  return res.json({
    success: true,
    data: result
  });
};

exports.getLifecycles = async (req, res, next) => {
  const eventTypes = await EventType.find({})
    .lean(); // To tell Mongoose we just need a plain JS object, so we can modify it.

  return res.status(200).json({
    success: true,
    data: eventTypes,
  });
};

exports.seed = async (req, res, next) => {
  if (!req.user.permissions.is.superadmin) {
    return helpers.makeForbiddenError('Only superadmin can seed lifecycles.');
  }

  const [ bodies, circles ] = await Promise.all(['bodies?limit=1000', 'circles?limit=1000'].map(elt => seed.queryAPI(elt, req.headers)));

  await EventType.remove({});

  const seedData = await seed.generateLifecycles({ bodies, circles });
  await EventType.insertMany(seedData);

  return res.json({
    success: true,
    data: 'Seeding lifecycles was successful.'
  });
}
