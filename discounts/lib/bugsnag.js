const bugsnag = require('@bugsnag/js');

const config = require('../config');
const logger = require('./logger');
const package = require('../package.json');

const bugsnagClient = bugsnag({
    apiKey: config.bugsnagKey,
    logger,
    appVersion: package.version,
    hostname: config.host,
    releaseStage: process.env.NODE_ENV
});

module.exports = bugsnagClient;
