const bugsnag = require('bugsnag');
const { errors, communication } = require('oms-common-nodejs');

const log = require('./logger');

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

      if (!req.user) {
        req.user = body.data;
      }

      if (!req.user.special) {
        req.user.special = ['Public']; // Everybody is included in 'Public', right?
      }

      return next();
    } catch (err) {
      return errors.makeInternalError(res, err);
    }
  };


/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }


    log.error(err.stack);
    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
    return errors.makeInternalError(res, err);
};
