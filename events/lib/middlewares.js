const request = require('request-promise-native');

const bugsnag = require('./bugsnag');
const errors = require('./errors');
const logger = require('./logger');
const { Event, Application } = require('../models');
const helpers = require('./helpers');
const config = require('../config');
const constants = require('./constants');

const packageInfo = require('../package');

exports.authenticateUser = async (req, res, next) => {
    // Query the core for user and permissions.
    const [userBody, permissionsBody] = await Promise.all(['members/me', 'my_permissions'].map((endpoint) => request({
        url: config.core.url + ':' + config.core.port + '/' + endpoint,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true,
        resolveWithFullResponse: true
    })));

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
        },
        resolveWithFullResponse: true
    });

    req.userRequest = userBody;
    req.permissionsRequest = permissionsBody;
    req.approveRequest = approveRequest;

    const errorObjectsMap = [
        { object: req.userRequest, name: 'user' },
        { object: req.permissionsRequest, name: 'permissions' },
        { object: req.approveRequest, name: 'permissions for approve' }
    ];

    // If the service returned faulty answer (either garbage, or HTTP code other than 401),
    // throw an error.
    for (const errorObject of errorObjectsMap) {
        if (typeof errorObject.object.body !== 'object') {
            throw new Error(`Malformed response when fetching ${errorObject.name}: ${errorObject.object.body}`);
        }

        // skipping 401 there, will catch them later in ensureAuthorized
        if (!errorObject.object.body.success && errorObject.object.statusCode !== 401) {
            throw new Error(`Error fetching ${errorObject.name}: ${JSON.stringify(errorObject.object.body)}`);
        }
    }

    if (req.userRequest.body && req.userRequest.body.success) req.user = userBody.body.data;
    if (req.permissionsRequest.body && req.permissionsRequest.body.success) req.corePermissions = permissionsBody.body.data;
    if (req.approveRequest.body && req.approveRequest.body.success) req.approvePermissions = approveRequest.body.data;

    req.permissions = helpers.getPermissions(req.user, req.corePermissions, req.approvePermissions);

    return next();
};

exports.ensureAuthorized = async (req, res, next) => {
    // If any of the services returned HTTP 401, then we are not authorized.
    if (req.userRequest.statusCode === 401 || req.permissionsRequest.statusCode === 401 || req.approveRequest.statusCode === 401) {
        return errors.makeUnauthorizedError(res, 'Error fetching data: user is not authenticated.');
    }

    return next();
};

exports.fetchSingleEvent = async (req, res, next) => {
    // Checking if the passed ID is a string or not.
    // If it is a string, find the event by URL, if not, find it by ID or URL.
    let findObject = { url: req.params.event_id };
    if (!Number.isNaN(Number(req.params.event_id))) {
        findObject = {
            id: Number(req.params.event_id)
        };
    }


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
};

exports.fetchSingleApplication = async (req, res, next) => {
    const whereObj = { event_id: req.event.id };

    if (req.params.application_id === constants.CURRENT_USER_PREFIX) { // / me, find by user_id
        whereObj.user_id = req.user.id;
    } else if (helpers.isNumber(req.params.application_id)) { // Find by application ID
        whereObj.id = Number(req.params.application_id);
    } else {
        return errors.makeBadRequestError(res, `Application ID should be either a number or ${constants.CURRENT_USER_PREFIX}`);
    }

    const application = await Application.findOne({ where: whereObj });
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

/* istanbul ignore next */
exports.healthcheck = (req, res) => {
    return res.json({
        success: true,
        data: {
            name: packageInfo.name,
            description: packageInfo.description,
            version: packageInfo.version
        }
    });
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
    logger.error({ err }, 'Request error');
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
