const morgan = require('morgan');

const log = require('./logger');

module.exports = morgan((tokens, req, res) => {
    log.info({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: tokens.status(req, res),
        length: tokens.res(req, res, 'content-length'),
        'response-time': tokens['response-time'](req, res),
        user: req.user,
        body: req.body
    }, 'Request processed');
});
