const requestPromise = require('request-promise-native');

const config = require('../../config');

const request = requestPromise.defaults({
    json: true,
    resolveWithFullResponse: true,
    simple: false,
    baseUrl: 'http://localhost:' + config.port,
    qsStringifyOptions: { arrayFormat: 'brackets' }
});

exports.request = request;
