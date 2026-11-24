const { request } = require('./http');

const Bugsnag = require('./bugsnag');
const constants = require('./constants');
const core = require('./core');
const errors = require('./errors');
const logger = require('./logger');
const { Application, Event } = require('../models');
const helpers = require('./helpers');
const { isPlainObject } = require('./validators');
const config = require('../config');

const packageInfo = require('../package.json');

// What a core call answers to a request without a token: nobody is logged in.
const NOT_AUTHENTICATED = { statusCode: 401, body: null };

exports.authenticateUser = async (req, res, next) => {
    // Without a token there is nobody to ask core about: the caller is anonymous. Public
    // routes answer as for any anonymous caller (also while core is down), the others 401.
    if (!req.headers['x-auth-token']) {
        req.userRequest = NOT_AUTHENTICATED;
        req.permissionsRequest = NOT_AUTHENTICATED;
        req.approveRequest = NOT_AUTHENTICATED;
        req.permissions = helpers.getPermissions();
        return next();
    }

    // Query the core for user and permissions.
    const [userBody, permissionsBody] = await Promise.all(['members/me', 'my_permissions'].map((endpoint) => request({
        url: config.core.url + ':' + config.core.port + '/' + endpoint,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        fullResponse: true
    })));

    // Fetching permissions for members approval, the list of bodies
    // where do you have the 'approve_members:summeruniversity' permission for it.
    const approveRequest = await request({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        body: {
            action: 'approve_members',
            object: 'summeruniversity'
        },
        fullResponse: true
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
        if (errorObject.object.body === null || typeof errorObject.object.body !== 'object') {
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
    // A whole number within the range of the id column is an id, anything else a URL
    // (URLs cannot be numbers only). Other numbers such as 1.5 or Infinity match no event.
    // URLs are stored in lower case (see the model's beforeValidate hook).
    let findObject = { url: req.params.event_id.toLowerCase() };
    if (helpers.isNumber(req.params.event_id)) {
        findObject = {
            id: Number(req.params.event_id)
        };
    }

    const event = await Event.findOne({ where: findObject });

    if (!event) {
        return errors.makeNotFoundError(res, `Event with id ${req.params.event_id} not found`);
    }

    req.event = event;
    req.permissions = await helpers.getEventPermissions({
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

    const user = await core.fetchApplicationUser(application.user_id);

    application.dataValues.gender = user.gender;
    application.dataValues.date_of_birth = user.date_of_birth;
    application.dataValues.notification_email = user.notification_email;

    req.application = application;
    req.applicant = user;
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

// Keys that would reach an object's prototype when the body is copied or merged.
const PROTOTYPE_KEYS = ['__proto__', 'constructor', 'prototype'];

// A JSON body is an object. bodyParser.json() also takes a list such as [1,2] (in its strict
// mode it takes nothing but objects and lists), which the handlers read as if it were an
// object: PUT /single/:id answered 200 and mailed the organizers. The body's own prototype
// keys are dropped: a __proto__ key made creating a Summer University answer 500. A request
// without a JSON body (none, or a file upload) has no req.body here and gets an empty one,
// which the handlers read like any other (POST / without a body answered 500).
exports.checkJsonBody = (req, res, next) => {
    if (req.body === undefined) {
        req.body = {};
        return next();
    }

    if (!isPlainObject(req.body)) {
        return errors.makeBadRequestError(res, 'The body should be an object.');
    }

    for (const key of PROTOTYPE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
            delete req.body[key];
        }
    }

    return next();
};

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

    if (process.env.NODE_ENV !== 'test') {
        Bugsnag.notify(err);
    }

    logger.error({ err }, 'Request error');
    return errors.makeInternalError(res, err);
};
