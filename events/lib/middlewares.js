const request = require('request-promise-native');
const bugsnag = require('bugsnag');

const errors = require('./errors');
const logger = require('./logger');
const { Event, Application } = require('../models');
const helpers = require('./helpers');
const config = require('../config');

exports.authenticateUser = async (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return errors.makeError(res, 401, 'No auth token provided');
    }

    try {
    // Query the core for user and permissions.
        const [userBody, permissionsBody] = await Promise.all(['members/me', 'my_permissions'].map(endpoint => request({
            url: config.core.url + ':' + config.core.port + '/' + endpoint,
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Auth-Token': req.headers['x-auth-token'],
            },
            simple: false,
            json: true,
        })));

        if (typeof userBody !== 'object') {
            throw new Error('Malformed response when fetching user: ' + userBody);
        }

        if (!userBody.success) {
      // We are not authenticated
            return errors.makeUnauthorizedError(res, 'Error fetching user: user is not authenticated.');
        }

        if (typeof permissionsBody !== 'object') {
            throw new Error('Malformed response when fetching permissions: ' + JSON.stringify(permissionsBody));
        }

        if (!permissionsBody.success) {
      // We are not authenticated
            return errors.makeUnauthorizedError(res, 'Error fetching permissions: user is not authenticated.');
        }

    // Fetching permissions for members approval, the list of bodies
    // where do you have the 'approve_members:events' permission for it.
        const approveRequest = await request({
            url: config.core.url + ':' + config.core.port + '/my_permissions',
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Auth-Token': req.headers['x-auth-token'],
            },
            simple: false,
            json: true,
            body: {
                action: 'approve_members',
                object: 'events'
            }
        });

        if (typeof approveRequest !== 'object') {
            throw new Error('Malformed response when fetching permissions for approve: ' + approveRequest);
        }

        if (!approveRequest.success) {
        // We are not authenticated
            throw new Error('Error fetching permissions for approve: user is not authenticated.');
        }

        req.user = userBody.data;
        req.corePermissions = permissionsBody.data;
        req.approvePermissions = approveRequest.data;
        req.permissions = helpers.getPermissions(req.user, req.corePermissions, req.approvePermissions);

        return next();
    } catch (err) {
        return errors.makeInternalError(res, err);
    }
};

exports.fetchSingleEvent = async (req, res, next) => {
    if (!req.params.event_id) {
        logger.info(req.params);
        return errors.makeNotFoundError(res, 'No Event-id provided');
    }

  // Checking if the passed ID is ObjectID or not.
  // We don't use ObjectID.isValid method, since it's not always
  // working properly, see http://stackoverflow.com/a/29231016/1206421
    let findObject;
    if (!Number.isNaN(Number(req.params.event_id))) { // if it's indeed an ObjectID
        findObject = { id: Number(req.params.event_id) };
    } else {
        findObject = { url: req.params.event_id };
    }

    try {
        const event = await Event.findOne({ where: findObject });

        if (!event) {
            return errors.makeNotFoundError(res, `Event with id ${req.params.event_id} not found`);
        }


        req.event = event;
        req.permissions = helpers.getEventPermissions({
            permissions: req.permissions,
            corePermissions: req.corePermissions,
            user: req.user,
            event
        });
        return next();
    } catch (err) {
        logger.error('Error getting single event: ', err);
        throw err;
    }
};

exports.fetchSingleApplication = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.application_id))) {
        return errors.makeBadRequestError(res, 'application_id should be a number.');
    }

    const application = await Application.findOne({ where: { id: Number(req.params.application_id) } });

    if (!application) {
        return errors.makeNotFoundError(res, `Application with id ${req.params.application_id} not found`);
    }

    req.application = application;
    req.permissions = helpers.getApplicationPermissions({
        permissions: req.permissions,
        application: req.application,
        corePermissions: req.corePermissions,
        approvePermissions: req.approvePermissions,
        user: req.user,
        event: req.event
    });
    return next();
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
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        return errors.makeValidationError(res, err);
    }

  /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }

  /* istanbul ignore next */
    logger.error(err.stack);
  /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
