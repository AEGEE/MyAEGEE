exports.makeError = (res, statusCode, err, message) => {
    // 4 cases:
    // 1) 'err' is a string
    // 2) 'err' is a ValidationError
    // 3) 'err' is a SequelizeValidationError
    // 4) 'err' is Error

    // If the error is a string, just forward it to user.
    if (typeof err === 'string') {
        return res.status(statusCode).json({
            success: false,
            message: err
        });
    }

    const msgText = message ? message + ' ' + err.message : err.message;

    // If the error is ValidationError, pass the errors details to the user.
    if (err.name && err.name === 'ValidationError') {
        return res.status(statusCode).json({
            success: false,
            message: msgText,
            errors: err.errors
        });
    }

    // If the error is SequelizeValidationError, pass the errors details to the user.
    if (err.name && (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError')) {
        // Reformat errors.
        return res.status(statusCode).json({
            success: false,
            errors: err.errors.reduce((acc, val) => {
                if (val.path in acc) {
                    acc[val.path].push(val.message);
                } else {
                    acc[val.path] = [val.message]
                }
                return acc;
            }, {})
        });
    }

    // Otherwise, just pass the error message.
    return res.status(statusCode).json({
        success: false,
        message: msgText
    });
};

exports.makeUnauthorizedError = (res, err, message) => exports.makeError(res, 401, err, message);
exports.makeValidationError = (res, err, message) => exports.makeError(res, 422, err, message);
exports.makeForbiddenError = (res, err, message) => exports.makeError(res, 403, err, message);
exports.makeNotFoundError = (res, err, message) => exports.makeError(res, 404, err, message);
exports.makeInternalError = (res, err, message) => exports.makeError(res, 500, err, message);
exports.makeBadRequestError = (res, err, message) => exports.makeError(res, 400, err, message);
