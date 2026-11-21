const onFinished = require('on-finished');
const {
    Counter,
    Registry
} = require('prom-client');

const endpointsRegistry = new Registry();
const responseCounter = new Counter({
    name: 'events_requests_total',
    help: 'Amount of total HTTP requests',
    labelNames: ['status', 'endpoint', 'method', 'path'],
    registers: [endpointsRegistry]
});

// Express only exposes the URL part a router matched (req.baseUrl, e.g. /bodies/42),
// not the pattern it was mounted on, so each mount records its pattern for the `path` label.
exports.recordMountPath = (mountPath) => (req, res, next) => {
    req.metricsMountPath = mountPath === '/' ? '' : mountPath;
    return next();
};

// Using the matched route pattern (e.g. /bodies/:body_id/boards) instead of the
// requested URL keeps the label's cardinality bounded.
function getPathLabel(req) {
    if (!req.route) {
        return 'unmatched';
    }

    const mountPath = req.metricsMountPath || '';
    return mountPath && req.route.path === '/' ? mountPath : mountPath + req.route.path;
}

exports.addEndpointMetrics = async (req, res, next) => {
    const callbackOnFinished = () => {
        const labelsObject = {
            endpoint: req.baseUrl + req.path,
            status: res.statusCode,
            path: getPathLabel(req),
            method: req.method
        };

        responseCounter.inc(labelsObject);
    };

    req.startTime = Date.now();

    onFinished(res, callbackOnFinished);
    return next();
};

exports.getEndpointMetrics = async (req, res) => {
    res.set('Content-Type', endpointsRegistry.contentType);
    res.end(await endpointsRegistry.metrics());
};
