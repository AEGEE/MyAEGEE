const morgan = require('morgan');

const log = require('./logger');

// The route pattern the request matched, such as /members/:user_id, instead of the
// concrete path, because paths carry usernames, body codes and other identifiers.
// Express only knows the part of the URL a router was mounted on (req.baseUrl), not its
// pattern, so each mount records its pattern in req.metricsMountPath (see the
// endpoint metrics' recordMountPath).
const routePattern = (req) => {
    const concretePath = req.originalUrl.split('?')[0];
    const mountPath = req.metricsMountPath || '';

    if (req.route) {
        return mountPath && req.route.path === '/' ? mountPath : mountPath + req.route.path;
    }

    if (mountPath) {
        // Answered inside a mounted router before a route matched, for example by an
        // authorization or lookup middleware: the mounted part becomes its pattern.
        const rest = concretePath.split('/').slice(mountPath.split('/').length);
        return [mountPath, ...rest].join('/');
    }

    // No route matched (a 404): the path without the query string.
    return concretePath;
};

// One line per request: what was called, how it ended and by which user id.
// Request bodies, headers, query strings, concrete paths and user details stay out of
// the log, because they can hold personal data, passwords and tokens.
module.exports = morgan((tokens, req, res) => {
    log.info({
        method: tokens.method(req, res),
        path: routePattern(req),
        status: tokens.status(req, res),
        length: tokens.res(req, res, 'content-length'),
        'response-time': tokens['response-time'](req, res),
        user_id: req.user ? req.user.id : undefined
    }, 'Request processed');
});
