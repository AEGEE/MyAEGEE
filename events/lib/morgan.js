const morgan = require('morgan');

const log = require('./logger');

module.exports = morgan((tokens, req, res) => {
    let result = [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms,',
        req.user ? ('user ' + req.user.user.name + ' with id ' + req.user.id) : 'unauthorized'
    ].join(' ');

    if (['PUT', 'POST'].includes(tokens.method(req, res))) {
        result += ', request body: ' + JSON.stringify(req.body, null, '  ');
    }

    return result;
}, { stream: log.stream });
