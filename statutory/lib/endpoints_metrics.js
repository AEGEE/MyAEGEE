const onFinished = require('on-finished');
const {
    Counter,
    Registry
} = require('prom-client');

const endpointsRegistry = new Registry();
const responseCounter = new Counter({
    name: 'statutory_requests_total',
    help: 'Amount of total HTTP requests',
    labelNames: ['status', 'path', 'endpoint', 'method'],
    registers: [endpointsRegistry]
});

exports.addEndpointMetrics = async (req, res, next) => {
    const callbackOnFinished = () => {
        const labelsObject = {
            endpoint: req.baseUrl + req.path,
            status: res.statusCode,
            path: req.originalUrl,
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
    res.end(endpointsRegistry.metrics());
};
