exports.makeError = (res, statusCode, err) => {
    // 4 cases:
    // 1) 'err' is a string
    // 2) 'err' is a SequelizeValidationError
    // 3) 'err' is a SequelizeUniqueConstraintError
    // 4) 'err' is Error

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
exports.makeInternalError = (res, err) => exports.makeError(res, 500, err);
exports.makeBadRequestError = (res, err) => exports.makeError(res, 400, err);
