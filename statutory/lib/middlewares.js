const core = require('./core');
const errors = require('./errors');
const helpers = require('./helpers');
const logger = require('./logger');
const constants = require('./constants');
const { Event, Application, Image } = require('../models');
const { Sequelize } = require('./sequelize');
const bugsnag = require('./bugsnag');
const packageInfo = require('../package');
const cron = require('./cron');

exports.authenticateUser = async (req, res, next) => {
    try {
        // Query the core for user and permissions.
        const [userBody, permissionsBody] = await Promise.all([
            core.getMyProfile(req),
            core.getMyPermissions(req)
        ]);

        req.userRequest = userBody;
        req.permissionsRequest = permissionsBody;

        const errorObjectsMap = [
            { object: req.userRequest, name: 'user' },
            { object: req.permissionsRequest, name: 'permissions' }
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

        req.permissions = helpers.getPermissions(req.user, req.corePermissions);

        return next();
    } catch (err) {
        return errors.makeInternalError(res, err);
    }
};

exports.ensureAuthorized = async (req, res, next) => {
    // If any of the services returned HTTP 401, then we are not authorized.
    if (
        req.userRequest.statusCode === 401
        || req.permissionsRequest.statusCode === 401
        || (req.approveRequest && req.approveRequest.statusCode === 401)
    ) {
        return errors.makeUnauthorizedError(res, 'Error fetching data: user is not authenticated.');
    }

    return next();
};

exports.fetchEvent = async (req, res, next) => {
    let query = {
        where: {
            url: { [Sequelize.Op.iLike]: req.params.event_id },
        }
    };

    // If event_id is not an integer, assuming it's the event URL.
    // If it's latest, fetch latest published.
    // If it's latest-agora, latest-epm or latest-spm, fetch latest Agora or EPM or SPM published.
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
    } else if (req.params.event_id === 'latest-spm') {
        query = {
            where: {
                type: 'spm',
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
    } else if (!Number.isNaN(Number(req.params.event_id))) {
        query = {
            where: { id: Number(req.params.event_id) }
        };
    }

    query.include = [Image];
    const event = await Event.findOne(query);

    if (!event) {
        return errors.makeNotFoundError(res, 'Event with such url or ID is not found.');
    }

    const approveRequest = await core.getApprovePermissions(req, event);

    if (typeof approveRequest.body !== 'object') {
        throw new Error('Malformed response when fetching permissions for approve');
    }

    // skipping 401 there, will catch them later in ensureAuthorized
    if (!approveRequest.body.success && approveRequest.statusCode !== 401) {
        throw new Error(`Error fetching permissions for approve: ${JSON.stringify(approveRequest.body)}`);
    }

    let myApplication;
    if (req.user) {
        myApplication = await Application.findOne({
            where: {
                user_id: req.user.id,
                event_id: event.id
            }
        });
    }

    req.event = event;
    req.myApplication = myApplication;
    req.approveRequest = approveRequest;
    if (req.approveRequest.body && req.approveRequest.body.success) req.approvePermissions = approveRequest.body.data;

    req.permissions = helpers.getEventPermissions({
        permissions: req.permissions,
        corePermissions: req.corePermissions,
        approvePermissions: req.approvePermissions,
        user: req.user,
        event,
        myApplication
    });

    return next();
};

exports.fetchSingleApplication = async (req, res, next) => {
    const whereObj = { event_id: req.event.id };

    if (req.params.application_id === constants.CURRENT_USER_PREFIX) { // / me, find by user_id
        whereObj.user_id = req.user.id;
    } else if (helpers.isNumber(req.params.application_id)) { // Find by application ID
        whereObj.id = Number(req.params.application_id);
    } else { // Find by statutory ID
        whereObj.statutory_id = req.params.application_id;
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
        application: req.application,
        mine: req.user.id === req.application.user_id
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

/* istanbul ignore next */
exports.getTasksList = (req, res) => {
    if (!req.permissions.see_background_tasks) {
        return errors.makeForbiddenError(res, 'You cannot see background tasks.');
    }

    return res.json({
        success: true,
        data: cron.jobs
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
    logger.error({ err });
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
