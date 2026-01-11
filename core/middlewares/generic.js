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

    req.user = accessToken.user;

    const circles = await Circle.findAll({ fields: ['id', 'parent_circle_id', 'body_id'] });

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

    // Handling validation errors
    /* istanbul ignore else */
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        return errors.makeValidationError(res, err);
    }

    /* istanbul ignore next */
    logger.error({ err }, 'Request error');
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
