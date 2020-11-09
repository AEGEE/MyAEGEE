const core = require('./core');
const errors = require('./errors');
const helpers = require('./helpers');
const logger = require('./logger');
const Bugsnag = require('./bugsnag');
const packageInfo = require('../package');

exports.authenticateUser = async (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return errors.makeError(res, 401, 'No auth token provided');
    }

    const [userBody, permissionsBody] = await Promise.all([
        core.getMyProfile(req),
        core.getMyPermissions(req)
    ]);

    if (typeof userBody !== 'object') {
        throw new Error('Malformed response when fetching user: ' + userBody);
    }

    // We only check user body here and not in the core helper
    // because if not authorized, we need to return 401.
    if (!userBody.success) {
        // We are not authenticated
        return errors.makeUnauthorizedError(res, 'Error fetching user: user is not authenticated.');
    }

    if (typeof permissionsBody !== 'object') {
        throw new Error('Malformed response when fetching permissions: ' + permissionsBody);
    }

    // Same store as with user body request.
    if (!permissionsBody.success) {
        return errors.makeUnauthorizedError(res, 'Error fetching permissions: user is not authenticated.');
    }

    req.user = userBody.data;
    req.corePermissions = permissionsBody.data;
    req.permissions = helpers.getPermissions(req.user, req.corePermissions);

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
        Bugsnag.notify(err);
    }

    /* istanbul ignore next */
    logger.error({ err }, 'Unhandled error');
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
