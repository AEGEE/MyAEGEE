const moment = require('moment');
const _ = require('lodash');

const errors = require('../lib/errors');
const logger = require('../lib/logger');
const helpers = require('../lib/helpers');
const {
    User,
    Circle,
    CircleMembership,
    CirclePermission,
    Permission,
    AccessToken
} = require('../models');
const { Sequelize } = require('../lib/sequelize');
const packageInfo = require('../package');

exports.maybeAuthorize = async (req, res, next) => {
    const authToken = req.headers['x-auth-token'];
    if (!authToken) {
        return next();
    }

    const accessToken = await AccessToken.findOne({
        where: {
            value: authToken,
        },
        include: [User]
    });

    if (!accessToken) {
        return next();
    }

    if (moment(accessToken.expires_at).isBefore(moment())) {
        logger.debug('Access token is expired');
        return next();
    }

    req.user = accessToken.user;

    // Fetching permissions.
    // 1) get the list of the circles user's in.
    const directCircleMemberships = await CircleMembership.findAll({
        where: { user_id: req.user.id }
    });

    // 2) get the list of all circles with only id and parent_circle_id
    // and converting it to a map to not look over the whole
    // array each time.
    req.allCircles = await Circle.findAll({ fields: ['id', 'parent_circle_id'] });
    req.allCirclesMap = _.keyBy(req.allCircles, 'id');

    // 3) fetch all the permissions
    const indirectCirclesArray = helpers.traverseIndirectCircles(req.allCirclesMap, directCircleMemberships.map((membership) => membership.circle_id));
    req.permissions = await Permission.findAll({
        where: {
            '$circle_permissions.circle_id$': { [Sequelize.Op.in]: indirectCirclesArray },
            scope: 'global'
        },
        include: [CirclePermission]
    });

    req.permissionsMap = _(req.permissions)
        .map((elt) => [elt, 1])
        .unzipWith()
        .value();

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

exports.getMyGlobalPermissions = async (req, res) => {
    return res.json({
        success: true,
        data: req.permissions
    });
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
    logger.error(err.stack);
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
