const onFinished = require('on-finished');
const {
    Counter,
    Registry
} = require('prom-client');

const endpointsRegistry = new Registry();
const responseCounter = new Counter({
    name: 'core_requests_total',
    help: 'Amount of total HTTP requests',
    labelNames: ['status', 'endpoint', 'method', 'path'],
    registers: [endpointsRegistry]
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMetricsPath(req) {
    const routePath = req.route && req.route.path ? req.route.path : req.path;
    let baseUrl = req.baseUrl || '';

    for (const [key, value] of Object.entries(req.params || {})) {
        if (typeof value === 'undefined' || value === null) {
            continue;
        }

        baseUrl = baseUrl.replace(new RegExp(`/${escapeRegex(String(value))}(?=/|$)`, 'g'), `/:${key}`);
    }

    return baseUrl + routePath;
}

exports.addEndpointMetrics = async (req, res, next) => {
    const callbackOnFinished = () => {
        const endpoint = req.baseUrl + req.path;

        // ignoring healthchecks and metrics requests
        if (endpoint.startsWith('/healthcheck') || endpoint.startsWith('/metrics')) {
            return;
        }

        const labelsObject = {
            endpoint,
            status: res.statusCode,
            path: buildMetricsPath(req),
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

exports.buildMetricsPath = buildMetricsPath;
