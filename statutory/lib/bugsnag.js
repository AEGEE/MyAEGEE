const bugsnag = require('@bugsnag/js');

const config = require('../config');
const logger = require('./logger');


const bugsnagClient = bugsnag({
    apiKey: config.bugsnagKey,
    logger,
    notifyReleaseStages: [ 'production' ]
});

module.exports = bugsnagClient;
