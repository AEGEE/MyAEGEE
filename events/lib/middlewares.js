const request = require('request-promise-native');
const bugsnag = require('bugsnag');
const { errors, communication } = require('oms-common-nodejs');

const log = require('./logger');
const { Event } = require('../models');
const helpers = require('./helpers');
const config = require('../config');

exports.authenticateUser = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return errors.makeError(res, 401, 'No auth token provided');
  }

  try {
    // Get the request headers to send an auth token
    const headers = await communication.getRequestHeaders(req);

    // Query the core for user and permissions.
    const [userBody, permissionsBody] = await Promise.all(['members/me', 'my_permissions'].map(endpoint => request({
      url: config.core.url + ':' + config.core.port + '/' + endpoint,
      method: 'GET',
      headers,
      simple: false,
      json: true,
    })));

    if (typeof userBody !== 'object') {
      throw new Error('Malformed response when fetching user: ' + userBody);
    }

    if (!userBody.success) {
      // We are not authenticated
      return errors.makeError(res, 401, 'Error fetching user: user is not authenticated.');
    }

    if (typeof permissionsBody !== 'object') {
      throw new Error('Malformed response when fetching permissions: ' + JSON.stringify(permissionsBody));
    }

    if (!permissionsBody.success) {
      // We are not authenticated
      return errors.makeError(res, 401, 'Error fetching permissions: user is not authenticated.');
    }

    req.user = userBody.data;
    req.corePermissions = permissionsBody.data;
    req.permissions = helpers.getPermissions(req.user, req.corePermissions);

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

    const headers = await communication.getRequestHeaders(req);

    // Fetching permissions for members approval, the list of bodies
    // where do you have the 'approve_members:<event_type>' permission for it.
    const approveRequest = await request({
      url: config.core.url + ':' + config.core.port + '/my_permissions',
      method: 'POST',
      headers,
      simple: false,
      json: true,
      body: {
        action: 'approve_members',
        object: event.type
      }
    });

    if (typeof approveRequest !== 'object') {
      throw new Error('Malformed response when fetching permissions for approve: ' + approveRequest);
    }

    if (!approveRequest.success) {
        // We are not authenticated
      throw new Error('Error fetching permissions for approve: user is not authenticated.');
    }

    req.event = event;
    req.approvePermissions = approveRequest.data;
    req.permissions = helpers.getEventPermissions({
      permissions: req.permissions,
      corePermissions: req.corePermissions,
      approvePermissions: req.approvePermissions,
      user: req.user,
      event
    });
    return next();
  } catch (err) {
    log.error('Error getting single event: ', err);
    throw err;
  }
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
