const { errors } = require('oms-common-nodejs');
const serverInfo = require('./info.js');

const log = require('./config/logger.js');

/* eslint-disable no-unused-vars */
exports.notFound = (req, res, next) => errors.makeNotFoundError(res, 'No such API endpoint: ' + req.method + ' ' + req.originalUrl);

/* eslint-disable no-unused-vars */
exports.errorHandler = (err, req, res, next) => {
    // Handling invalid JSON

    log.error(`(${serverInfo.host()}) : error handler says: `+err);

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return errors.makeBadRequestError(res, 'Invalid JSON.');
    }

    // // Handling validation errors
    // if (err.name && err.name === 'SequelizeValidationError') {
    //     return errors.makeValidationError(res, err);
    // }

    /* istanbul ignore next */
    // if (process.env.NODE_ENV !== 'test') {
    //     bugsnag.notify(err);
    // }

    /* istanbul ignore next */
    log.error(err.stack);
    /* istanbul ignore next */
    return errors.makeInternalError(res, err);
};