const core = require('./core');
const errors = require('./errors');
const helpers = require('./helpers');
const logger = require('./logger');
const { Sequelize } = require('./sequelize');
const constants = require('./constants');
const { Event, Application, Image, PaxLimit, MembersList } = require('../models');
const Bugsnag = require('./bugsnag');
const packageInfo = require('../package.json');
const cron = require('./cron');
const { isLockTimeout } = require('./locks');

// The only route that takes a list as its body: the board view of a body.
const LIST_BODY_ROUTE = /^\/events\/[^/]+\/applications\/boardview\/[^/]+\/?$/;

// What JSON can hold and the database cannot: the NUL character and unpaired surrogates.
// eslint-disable-next-line no-control-regex -- the NUL character is what is looked for
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// Deeper bodies are not read: no route takes more than a few levels.
const MAX_DEPTH = 32;

// Whether a parsed body is too deep, or holds a text or key with characters that cannot be stored.
// Walked without recursion, so that a deep body cannot exhaust the stack.
const inspectBody = (body) => {
    const stack = [{ value: body, depth: 0 }];
    while (stack.length > 0) {
        const { value, depth } = stack.pop();
        if (typeof value === 'string') {
            if (UNSTORABLE.test(value)) {
                return 'unstorable';
            }
        } else if (helpers.isObject(value)) {
            if (depth >= MAX_DEPTH) {
                return 'too deep';
            }

            for (const [key, item] of Object.entries(value)) {
                if (UNSTORABLE.test(key)) {
                    return 'unstorable';
                }

                stack.push({ value: item, depth: depth + 1 });
            }
        }
    }

    return null;
};

// Every route that takes a body takes an object, apart from the board view of a body, which
// takes a list. A request without a body is handled like one with an empty object, so that a
// route answers as it does for missing fields.
exports.checkRequestBody = (req, res, next) => {
    if (req.body === undefined) {
        req.body = {};
        return next();
    }

    const problem = inspectBody(req.body);
    if (problem === 'too deep') {
        return errors.makeBadRequestError(res, 'The request body could not be read.');
    }

    if (problem === 'unstorable') {
        return errors.makeBadRequestError(res, 'The request body contains characters that cannot be stored.');
    }

    const takesList = req.method === 'POST' && LIST_BODY_ROUTE.test(req.path);
    if (!takesList && (!helpers.isObject(req.body) || Array.isArray(req.body))) {
        return errors.makeBadRequestError(res, 'The body should be an object.');
    }

    return next();
};

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
        logger.error({ err }, 'Could not fetch the user and the permissions from core');
        return errors.makeInternalError(res);
    }
};

exports.ensureAuthorized = async (req, res, next) => {
    // If any of the services returned HTTP 401, then we are not authorized.
    if (
        req.userRequest.statusCode === 401
        || req.permissionsRequest.statusCode === 401
        || (req.approveRequest && req.approveRequest.statusCode === 401)
        || (req.memberslistRequest && req.memberslistRequest.statusCode === 401)
    ) {
        return errors.makeUnauthorizedError(res, 'Error fetching data: user is not authenticated.');
    }

    return next();
};

exports.fetchEvent = async (req, res, next) => {
    // The URL as it is written, in any case. Both sides are compared in lower case:
    // the URLs of older events are stored with the capitals they were written with.
    let query = {
        where: Sequelize.where(
            Sequelize.fn('lower', Sequelize.col('event.url')),
            req.params.event_id.toLowerCase()
        )
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
    } else if (helpers.isNumber(req.params.event_id)) {
        query = {
            where: { id: Number(req.params.event_id) }
        };
    }

    query.include = [Image];
    const event = await Event.findOne(query);

    // A draft answers like an event that does not exist, unless the user manages events of its type.
    if (!event || !helpers.canSeeEvent(event, req.corePermissions)) {
        return errors.makeNotFoundError(res, 'Event with such url or ID is not found.');
    }

    const [approveRequest, memberslistRequest] = await Promise.all([
        core.getApprovePermissions(req, event),
        core.getMemberslistPermissions(req, event)
    ]);

    if (typeof approveRequest.body !== 'object') {
        throw new Error('Malformed response when fetching permissions for approve');
    }

    // skipping 401 there, will catch them later in ensureAuthorized
    if (!approveRequest.body.success && approveRequest.statusCode !== 401) {
        throw new Error(`Error fetching permissions for approve: ${JSON.stringify(approveRequest.body)}`);
    }

    if (typeof memberslistRequest.body !== 'object') {
        throw new Error('Malformed response when fetching permissions for memberslist');
    }

    if (!memberslistRequest.body.success && memberslistRequest.statusCode !== 401) {
        throw new Error(`Error fetching permissions for memberslist: ${JSON.stringify(memberslistRequest.body)}`);
    }

    let limits = [];
    let myApplication;
    if (req.user) {
        myApplication = await Application.findOne({
            where: {
                user_id: req.user.id,
                event_id: event.id
            }
        });
        limits = await Promise.all(
            req.user.bodies.map((body) => PaxLimit.fetchOrUseDefaultForBody(body, event.type))
        );
    }

    req.event = event;
    req.myApplication = myApplication;
    req.approveRequest = approveRequest;
    req.memberslistRequest = memberslistRequest;
    if (req.approveRequest.body && req.approveRequest.body.success) req.approvePermissions = approveRequest.body.data;
    if (req.memberslistRequest.body && req.memberslistRequest.body.success) req.memberslistPermissions = memberslistRequest.body.data;

    req.permissions = helpers.getEventPermissions({
        permissions: req.permissions,
        corePermissions: req.corePermissions,
        approvePermissions: req.approvePermissions,
        memberslistPermissions: req.memberslistPermissions,
        user: req.user,
        event,
        limits,
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

    const [mail] = await core.getMails(req, application.user_id);

    if (mail) {
        application.dataValues.notification_email = mail.notification_email;
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

    if (req.permissions.see_application_incoming && !req.permissions.see_application) {
        whereObj.status = 'accepted';
        whereObj.cancelled = false;

        const incomingApplication = await Application.findOne({
            attributes: constants.ALLOWED_INCOMING_FIELDS,
            where: whereObj
        });

        if (!incomingApplication) {
            return errors.makeNotFoundError(res, userPrefix + ' haven\'t applied to this event yet.');
        }

        if (mail) {
            incomingApplication.dataValues.notification_email = mail.notification_email;
        }

        req.application = incomingApplication;
    }

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
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl.split('?')[0]);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }

    // A path whose encoding is broken (%E0): Express cannot decode its parameters.
    if (err instanceof URIError && err.status === 400) {
        return errors.makeBadRequestError(res, 'The path could not be read.');
    }

    // The other errors of reading the body (too large, a charset or an encoding that is not
    // supported, a broken compression) answer with their own status.
    if (err.expose === true && err.status >= 400 && err.status < 500) {
        return errors.makeError(res, err.status, 'The request body could not be read.');
    }

    // Handling validation errors
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        return errors.makeValidationError(res, err);
    }

    // The currency rates server did not answer in time or failed: nothing was saved.
    if (err instanceof MembersList.RatesUnavailable) {
        logger.warn({ err }, 'Could not fetch the currency rates');
        return errors.makeServiceUnavailableError(res, 'The currency rates could not be fetched, so nothing was saved. Please try again later.');
    }

    // A lock that other requests held for longer than the lock timeout: nothing was changed.
    if (isLockTimeout(err)) {
        return errors.makeServiceUnavailableError(res, 'The server is busy, please try again.');
    }

    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') {
        Bugsnag.notify(err);
    }

    /* istanbul ignore next */
    logger.error({ err });
    /* istanbul ignore next */
    return errors.makeInternalError(res);
};
