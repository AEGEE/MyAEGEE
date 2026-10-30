const morgan = require('morgan');

const log = require('./logger');

// Log only request metadata and the id of the user.
// Never log the request body, names or e-mail addresses: they are personal data.
module.exports = morgan((tokens, req, res) => {
    log.info({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: tokens.status(req, res),
        length: tokens.res(req, res, 'content-length'),
        'response-time': tokens['response-time'](req, res),
        user: req.user ? { id: req.user.id } : undefined
    }, 'Request processed');
});
