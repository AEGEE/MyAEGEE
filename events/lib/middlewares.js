const request = require('request-promise-native');
const bugsnag = require('bugsnag');
const { errors, communication } = require('oms-common-nodejs');

const log = require('./config/logger.js');
const Event = require('./models/Event');
const helpers = require('./helpers.js');
const config = require('./config/config.js');

exports.authenticateUser = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return errors.makeUnauthorizedError(res, 'No auth token provided');
  }


  try {
    // Find the core service
    const service = await communication.getServiceByName(config.registry, 'oms-core-elixir');

    // Get the request headers to send an auth token
    const headers = await communication.getRequestHeaders(req);

    // Query the core
    const body = await request({
      url: `${service.backend_url}members/me`,
      method: 'GET',
      headers,
      simple: false,
      json: true,
    });

    if (typeof body !== 'object') {
      return errors.makeInternalError(res, 'Malformed response from core: ' + body);
    }

    if (!body.success) {
      // We are not authenticated
      return errors.makeUnauthorizedError(res, 'User is not authenticated.');
    }

    if (!req.user) {
      req.user = body.data;
    }

    if (!req.user.special) {
      req.user.special = ['Public']; // Everybody is included in 'Public', right?
    }

    return next();
  } catch (err) {
    return errors.makeInternalError(res, err);
  }
};

exports.fetchSingleEvent = async (req, res, next) => {
  if (!req.params.event_id) {
    log.info(req.params);
    return errors.makeNotFoundError(res, 'No Event-id provided');
  }

  // Checking if the passed ID is ObjectID or not.
  // We don't use ObjectID.isValid method, since it's not always
  // working properly, see http://stackoverflow.com/a/29231016/1206421
  let findObject;
  if (req.params.event_id.match(/^[0-9a-fA-F]{24}$/)) { // if it's indeed an ObjectID
    findObject = { _id: req.params.event_id };
  } else {
    findObject = { url: req.params.event_id };
  }

  try {
    const event = await Event.findOne(findObject);

    if (event === null) {
      return errors.makeNotFoundError(res, `Event with id ${req.params.event_id} not found`);
    }

    req.event = event;
    return next();
  } catch (err) {
    log.error('Error getting single event: ', err);
    throw err;
  }
};

// Middleware to check which permissions the user has, in regart to the current
// event if there is one. Requires the fetchSingleEvent and fetchUserDetails
// middleware to be executed beforehand.
exports.checkPermissions = async (req, res, next) => {
  const permissions = helpers.getBasicPermissions(req.user);

  // Convert all to boolean and assign
  req.user.permissions = { is: {}, can: {} };
  for (const attr in permissions.is) {
    req.user.permissions.is[attr] = permissions.is[attr];
  }
  for (const attr in permissions.can) {
    req.user.permissions.can[attr] = permissions.can[attr];
  }
  req.user.special = [...req.user.special, ...permissions.special];

  return next();
};

// This should be executed after .fetchSingleEvent call
exports.checkEventPermissions = async (req, res, next) => {
  const eventPermissions = helpers.getEventPermissions(req.event, req.user);

  for (const attr in eventPermissions.is) {
    req.user.permissions.is[attr] = eventPermissions.is[attr];
  }
  for (const attr in eventPermissions.can) {
    req.user.permissions.can[attr] = eventPermissions.can[attr];
  }
  if (eventPermissions.special) {
    Array.prototype.push.apply(req.user.special, eventPermissions.special);
  }

  // Filter out links
  req.event.links = req.event.links.filter(link =>
    helpers.canUserAccess(req.user, link.visibility));

  next();
};

/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
  // Handling invalid JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errors.makeBadRequestError(res, 'Invalid JSON.');
  }

  // Handling validation errors
  if (err.name && err.name === 'ValidationError') {
    return errors.makeValidationError(res, err);
  }

  log.error(err.stack);
  if (process.env.NODE_ENV !== 'test') {
    bugsnag.notify(err);
  }
  return errors.makeInternalError(res, err);
};
