const bugsnag = require('bugsnag');
const request = require('request-promise-native');
const { errors, communication } = require('oms-common-nodejs');

const config = require('../config');
const helpers = require('./helpers');
const logger = require('./logger');
const { Event, Application } = require('../models');
const { Sequelize } = require('./sequelize');

exports.authenticateUser = async (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return errors.makeForbiddenError(res, 'No auth token provided');
    }

    try {
        // Find the core service
        const service = await communication.getServiceByName(config.registry, 'oms-core-elixir');

        // Get the request headers to send an auth token
        const headers = await communication.getRequestHeaders(req);

        // Query the core for user and permissions.
        const [ userBody, permissionsBody ] = await Promise.all(['members/me', 'my_permissions'].map(endpoint => request({
            url: service.backend_url + endpoint,
            method: 'GET',
            headers,
            simple: false,
            json: true,
        })));

        if (typeof userBody !== 'object') {
            return errors.makeInternalError(res, 'Malformed response when fetching user: ' + userBody);
        }

        if (!userBody.success) {
            // We are not authenticated
            return errors.makeForbiddenError(res, 'Error fetching user: user is not authenticated.');
        }

        if (typeof permissionsBody !== 'object') {
            return errors.makeInternalError(res, 'Malformed response when fetching permissions: ' + body);
        }

        if (!permissionsBody.success) {
            // We are not authenticated
            return errors.makeForbiddenError(res, 'Error fetching permissions: user is not authenticated.');
        }

        req.user = userBody.data;
        req.corePermissions = permissionsBody.data;
        req.permissions = helpers.getPermissions(req.user, req.corePermissions);
        req.user.special = ['Public']; // Everybody is included in 'Public', right?

        return next();
    } catch (err) {
        return errors.makeInternalError(res, err);
    }
};

function fetchEvent(includeApplications = false) {
    return async (req, res, next) => {
        let query = {
            where: {
                id: req.params.event_id,
            }
        };

        // If event_id is not an integer, assuming it's the event URL.
        if (Number.isNaN(parseInt(req.params.event_id))) {
            query = {
                where: {
                    url: { [Sequelize.Op.iLike]: req.params.event_id },
                }
            }
        }

        if (includeApplications) query.include = [Application]
        const event = await Event.findOne(query);

        if (!event) {
            return errors.makeNotFoundError(res, 'Event with such url or ID is not found.');
        }

        const service = await communication.getServiceByName(config.registry, 'oms-core-elixir');
        const headers = await communication.getRequestHeaders(req);

        // Fetching permissions for members approval, the list of bodies
        // where do you have the 'approve_participants:<event_type>' permission for it.
        const approveRequest = await request({
            url: service.backend_url + 'my_permissions',
            method: 'POST',
            headers,
            simple: false,
            json: true,
            body: {
                action: 'approve_participants',
                object: event.type
            }
        });

        if (typeof approveRequest !== 'object') {
            return errors.makeInternalError(res, 'Malformed response when fetching permissions for approve: ' + body);
        }

        if (!approveRequest.success) {
            // We are not authenticated
            return errors.makeForbiddenError(res, 'Error fetching permissions for approve: user is not authenticated.');
        }

        req.event = event;
        req.approvePermissions = approveRequest.data;
        req.permissions = helpers.getEventPermissions({
            permissions: req.permissions,
            corePermissions: req.corePermissions,
            approvePermissions: req.approvePermissions,
            event
        });

        return next();
    }
}

exports.fetchEvent = fetchEvent(false)
exports.fetchEventWithApplications = fetchEvent(true)


/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }

    // Handling validation errors
    if (err.name && err.name === 'SequelizeValidationError') {
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
