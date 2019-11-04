const deepAssign = require('deep-assign');

const config = {
    default: {
        port: 8084,
        postgres: {
            host: process.env.DB_HOST || 'postgres-oms-statutory',
            port: parseInt(process.env.DB_PORT, 10) || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.PG_PASSWORD || '5ecr3t',
            database: process.env.DB_DATABASE || 'statutory',
        },
        core: {
            url: 'http://oms-core-elixir',
            port: 4000
        },
        mailer: {
            url: 'http://oms-mailer',
            port: 4000
        },
        logger: {
            silent: false,
            level: process.env.LOGLEVEL || 'debug'
        },
        bugsnagKey: process.env.BUGSNAG_KEY || '',
        images_dir: '/usr/app/media',
        media_url: '/media/'
    },
    development: {

    },
    test: {
        port: 8085,
        postgres: {
            host: 'localhost',
            database: 'statutory-testing'
        },
        logger: {
            silent: (typeof process.env.ENABLE_LOGGING !== 'undefined') ? (!process.env.ENABLE_LOGGING) : true
        },
        bugsnagKey: 'CHANGEME',
        images_dir: './tmp_upload'
    }
};


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
    throw new Error(`Both 'default' and '${process.env.NODE_ENV}' are not set in config/index.js; \
cannot run without config.`);
}

// If we have the default config, set it first.
let appConfig = config.default || {};

// If we have the environment config, overwrite the config's fields with its fields
if (config[env]) {
    appConfig = deepAssign(appConfig, config[env]);
}

module.exports = appConfig;
