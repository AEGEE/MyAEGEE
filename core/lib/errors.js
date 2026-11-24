// For input that can't be processed. The error handler answers 400 with the message.
class BadRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BadRequestError';
    }
}

exports.BadRequestError = BadRequestError;

// For a mail that could not be sent. The routes that send one inside their transaction
// roll back, and the error handler answers 503.
exports.createMailError = (message, cause) => {
    const err = new Error(message, { cause });
    err.name = 'MailError';
    return err;
};
exports.isMailError = (err) => err.name === 'MailError';

exports.makeError = (res, statusCode, err) => {
    // 4 cases:
    // 1) 'err' is a string
    // 2) 'err' is a SequelizeValidationError
    // 3) 'err' is a SequelizeUniqueConstraintError
    // 4) 'err' is Error
    // 5) 'err' is Object

    // If the error is a string, just forward it to user.
    if (typeof err === 'string') {
        return res.status(statusCode).json({
            success: false,
            message: err
        });
    }

    // If the error is SequelizeValidationError or SequelizeUniqueConstraintError, pass the errors details to the user.
    if (err.name && ['SequelizeValidationError', 'SequelizeUniqueConstraintError'].includes(err.name)) {
        // Reformat errors.
        return res.status(statusCode).json({
            success: false,
            errors: err.errors.reduce((acc, val) => {
                if (val.path in acc) {
                    acc[val.path].push(val.message);
                } else {
                    acc[val.path] = [val.message];
                }
                return acc;
            }, {})
        });
    }

    if (typeof err === 'object' && !(err instanceof Error)) {
        return res.status(statusCode).json({
            success: false,
            errors: err
        });
    }

    // Otherwise, just pass the error message.
    return res.status(statusCode).json({
        success: false,
        message: err.message
    });
};

exports.makeUnauthorizedError = (res, err) => exports.makeError(res, 401, err);
exports.makeValidationError = (res, err) => exports.makeError(res, 422, err);
exports.makeForbiddenError = (res, err) => exports.makeError(res, 403, err);
exports.makeNotFoundError = (res, err) => exports.makeError(res, 404, err);
exports.makeConflictError = (res, err) => exports.makeError(res, 409, err);
// The answer never carries the text of the error: it can be a database error or the answer
// of another service. Whoever calls this logs the error.
exports.makeInternalError = (res) => exports.makeError(res, 500, 'Something went wrong on the server.');
exports.makeBadRequestError = (res, err) => exports.makeError(res, 400, err);

// For a request that gave up waiting for another request that locks the same data.
exports.makeBusyError = (res) => exports.makeError(res, 503, 'Another request for the same data is being processed. Please try again in a moment.');

// For a request that rolled back because its mail could not be sent.
exports.makeMailError = (res) => exports.makeError(res, 503, 'The mail could not be sent, so nothing was saved. Please try again later.');

// What Postgres answers when a statement waited for a lock for longer than `lock_timeout`.
exports.isLockTimeout = (err) => Boolean(err && err.parent && err.parent.code === '55P03');
