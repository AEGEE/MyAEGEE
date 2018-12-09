const bugsnag = require('@bugsnag/js');

const config = require('../config');

const bugsnagClient = bugsnag({
    apiKey: config.bugsnagKey
});

module.exports = bugsnagClient;
