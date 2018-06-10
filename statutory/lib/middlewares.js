const bugsnag = require('bugsnag');
const request = require('request-promise-native');
const { errors, communication } = require('oms-common-nodejs');

const config = require('../config');
const helpers = require('./helpers');
const Event = require('../models/Event');
const { Sequelize } = require('./sequelize');

exports.authenticateUser = async (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return errors.makeForbiddenError(res, 'No auth token provided');
    }

    try {
        // Find the core service
        const service = await communication.getServiceByName(config.registry, 'oms-core-elixir');

        // Get the request headers to send an auth token
        const headers = await communication.getRequestHeaders(req);

        // Query the core
        const body = await request({
            url: `${service.backend_url}members/me`,
            method: 'GET',
            headers,
            simple: false,
            json: true,
        });

        if (typeof body !== 'object') {
            return errors.makeInternalError(res, 'Malformed response from core: ' + body);
        }

        if (!body.success) {
            // We are not authenticated
            return errors.makeForbiddenError(res, 'User is not authenticated.');
        }

        req.user = body.data;
        req.user.permissions = helpers.getPermissions(req.user);
        req.user.special = ['Public']; // Everybody is included in 'Public', right?

        return next();
    } catch (err) {
        return errors.makeInternalError(res, err);
    }
};

exports.fetchEvent = async (req, res, next) => {
    let query = {
        where: {
            id: req.params.event_id,
        }
    };

    // If event_id is not an integer, assuming it's the event URL.
    if (Number.isNaN(parseInt(req.params.event_id))) {
        query = {
            where: {
                url: { [Sequelize.Op.iLike]: req.params.event_id },
            }
        }
    }
    const event = await Event.findOne(query);

    if (!event) {
        return errors.makeNotFoundError(res, 'Event with such url or ID is not found.');
    }

    req.event = event;
    return next();
}


/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }

    // Handling validation errors
    if (err.name && err.name === 'SequelizeValidationError') {
        return errors.makeValidationError(res, err);
    }

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
    return errors.makeInternalError(res, err);
};
