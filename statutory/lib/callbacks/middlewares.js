const bugsnag = require('bugsnag');

const log = require('../logger');
const helpers = require('../helpers');


/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => helpers.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return helpers.makeBadRequestError(res, 'Invalid JSON.');
    }


    log.error(err.stack);
    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
    return helpers.makeInternalError(res, err);
};
