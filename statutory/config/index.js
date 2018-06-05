const deepAssign = require('deep-assign');

const config = require('./config.json');

// Assuming by default that we run in 'development' environment, if no
// NODE_ENV is specified.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const env = process.env.NODE_ENV;

// The config.json file can contain a 'default' field and some environment
// fields. (e.g. 'development'). The 'default' field is loaded first, if exists,
// and then its fields are overwritten by the environment field, if exists.
// If both 'default' and environment fields are missing, than there's no config
// and we throw an error.
if (!config[env] && !config.default) {
    throw new Error(`Both 'default' and '${process.env.NODE_ENV}' are not set in lib/config.json; \
cannot run without config.`);
}

// If we have the default config, set it first.
let appConfig = config.default || {};

// If we have the environment config, overwrite the config's fields with its fields
if (config[env]) {
    appConfig = deepAssign(appConfig, config[env]);
}

module.exports = appConfig;
