const moment = require('moment');

const errors = require('../lib/errors');
const logger = require('../lib/logger');
const { User, AccessToken } = require('../models');

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
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        return errors.makeValidationError(res, err);
    }

    /* istanbul ignore next */
    logger.error(err.stack);
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};
