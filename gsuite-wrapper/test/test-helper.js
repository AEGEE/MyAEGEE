const requestPromise = require('request-promise-native');

const config = require('../lib/config');

const request = requestPromise.defaults({
    json: true,
    resolveWithFullResponse: true,
    simple: false,
    baseUrl: 'http://localhost:' + config.port
});

exports.request = request;
