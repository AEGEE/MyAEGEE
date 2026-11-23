const morgan = require('morgan');

const log = require('./logger');

// One line per request: what was called, how it ended and by which user id.
// Request bodies, headers, query strings and user details stay out of the log,
// because they can hold personal data, passwords and tokens.
module.exports = morgan((tokens, req, res) => {
    log.info({
        method: tokens.method(req, res),
        path: req.originalUrl.split('?')[0],
        status: tokens.status(req, res),
        length: tokens.res(req, res, 'content-length'),
        'response-time': tokens['response-time'](req, res),
        user_id: req.user ? req.user.id : undefined
    }, 'Request processed');
});
