const moment = require('moment');

const errors = require('../lib/errors');
const logger = require('../lib/logger');
const {
    User,
    AccessToken,
    Circle,
    Body,
    BodyMembership,
    JoinRequest,
} = require('../models');
const packageInfo = require('../package.json');
const PermissionManager = require('../lib/permissions-manager');

exports.maybeAuthorize = async (req, res, next) => {
    const authToken = req.headers['x-auth-token'];
    if (!authToken) {
        return next();
    }

    const accessToken = await AccessToken.findOne({
        where: {
            value: authToken,
        },
        include: [{
            model: User,
            include: [
                { model: Body, as: 'bodies' },
                { model: Body, as: 'primary_body' },
                { model: BodyMembership, as: 'body_memberships' },
                { model: JoinRequest, as: 'join_requests' },
                { model: Circle, as: 'circles' }
            ]
        }]
    });

    if (!accessToken) {
        return next();
    }

    if (moment(accessToken.expires_at).isBefore(moment())) {
        logger.debug('Access token is expired');
        return next();
    }

    // A suspended member is not logged in, whatever tokens they still have.
    if (!accessToken.user.active) {
        logger.debug('Access token belongs to a suspended member');
        return next();
    }

    req.user = accessToken.user;

    // Only what the permissions are computed from, of every circle there is.
    const circles = await Circle.findAll({ attributes: ['id', 'parent_circle_id', 'body_id'] });

    req.permissions = new PermissionManager({ user: req.user });
    req.permissions.addCircles(circles);

    await req.permissions.fetchCurrentUserPermissions();

    await req.user.update({ last_active: new Date() });

    return next();
};

exports.ensureAuthorized = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'You are not authorized.'
        });
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

/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }

    // Handling a body the JSON parser could not read (too large, an unknown charset or
    // encoding, a compressed body that does not decompress): its own status, a fixed text.
    if (err.expose && err.status >= 400 && err.status < 500) {
        return errors.makeError(res, err.status, 'The request body could not be read.');
    }

    // Handling input that a helper refused (like a field that a list can't be sorted by)
    if (err instanceof errors.BadRequestError) {
        return errors.makeBadRequestError(res, err.message);
    }

    // Handling a mail that could not be sent: the route rolled back, so trying again may work
    if (errors.isMailError(err)) {
        logger.error({ err }, 'Could not send a mail');
        return errors.makeMailError(res);
    }

    // Handling a request that gave up waiting for another one (see helpers.setLockTimeout)
    if (errors.isLockTimeout(err)) {
        return errors.makeBusyError(res);
    }

    // Handling validation errors
    /* istanbul ignore else */
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        return errors.makeValidationError(res, err);
    }

    /* istanbul ignore next */
    logger.error({ err }, 'Request error');
    /* istanbul ignore next */
    return errors.makeInternalError(res);
};
