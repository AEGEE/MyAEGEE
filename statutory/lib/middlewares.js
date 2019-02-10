const request = require('request-promise-native');
const { errors, communication } = require('oms-common-nodejs');

const config = require('../config');
const helpers = require('./helpers');
const logger = require('./logger');
const constants = require('./constants');
const { Event, Application } = require('../models');
const { Sequelize } = require('./sequelize');
const bugsnag = require('./bugsnag');

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
            return errors.makeUnauthorizedError(res, 'Error fetching user: user is not authenticated.');
        }

        if (typeof permissionsBody !== 'object') {
            throw new Error('Malformed response when fetching permissions: ' + JSON.stringify(permissionsBody));
        }

        if (!permissionsBody.success) {
            // We are not authenticated
            return errors.makeUnauthorizedError(res, 'Error fetching permissions: user is not authenticated.');
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

function fetchEvent(includeApplications) {
    return async (req, res, next) => {
        let query = {
            where: {
                id: req.params.event_id,
            }
        };

        // If event_id is not an integer, assuming it's the event URL.
        // If it's latest, fetch latest published.
        // If it's latest-agora or latest-epm, fetch latest Agora or EPM published.
        if (req.params.event_id === 'latest-agora') {
            query = {
                where: {
                    type: 'agora',
                    status: 'published'
                },
                order: [['starts', 'DESC']]
            };
        } else if (req.params.event_id === 'latest-epm') {
            query = {
                where: {
                    type: 'epm',
                    status: 'published'
                },
                order: [['starts', 'DESC']]
            };
        } else if (req.params.event_id === 'latest') {
            query = {
                where: {
                    status: 'published'
                },
                order: [['starts', 'DESC']]
            };
        } else if (Number.isNaN(parseInt(req.params.event_id, 10))) {
            query = {
                where: {
                    url: { [Sequelize.Op.iLike]: req.params.event_id },
                }
            };
        }

        if (includeApplications) query.include = [Application];
        const event = await Event.findOne(query);

        if (!event) {
            return errors.makeNotFoundError(res, 'Event with such url or ID is not found.');
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
    };
}

exports.fetchEvent = fetchEvent(false);
exports.fetchEventWithApplications = fetchEvent(true);

exports.fetchSingleApplication = async (req, res, next) => {
    // ID is either 'me' or an integer (user ID)
    if (!helpers.isIDValid(req.params.application_id)) {
        return errors.makeBadRequestError(res, `Application ID should be either a number or '${constants.CURRENT_USER_PREFIX}'`);
    }

    const whereObj = { event_id: req.event.id };

    if (req.params.application_id === constants.CURRENT_USER_PREFIX) { // /me, find by user_id
        whereObj.user_id = req.user.id;
    } else { // Find by application ID
        whereObj.id = parseInt(req.params.application_id, 10);
    }

    const userPrefix = req.params.application_id === constants.CURRENT_USER_PREFIX ? 'You' : 'This user';

    const application = await Application.findOne({ where: whereObj });
    if (!application) {
        return errors.makeNotFoundError(res, userPrefix + ' haven\'t applied to this event yet.');
    }

    req.application = application;

    req.permissions = helpers.getApplicationPermissions({
        permissions: req.permissions,
        corePermissions: req.corePermissions,
        user: req.user,
        event: req.event,
        mine: req.user.id === req.application.user_id
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
