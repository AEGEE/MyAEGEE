const merge = require('../lib/merge');

const config = {
    default: {
        port: 8084,
        postgres: {
            host: process.env.DB_HOST || 'postgres-core',
            port: parseInt(process.env.DB_PORT, 10) || 5432,
            username: process.env.USERNAME || 'postgres',
            password: process.env.PG_PASSWORD || '5ecr3t',
            database: process.env.DB_DATABASE || 'core'
        },
        mailer: {
            url: 'http://mailer',
            port: 4000
        },
        listserv_email: process.env.LISTSERV_EMAIL || 'listserv@example.com',
        listserv_endpoint: process.env.LISTSERV_ENDPOINT || 'https://lists.example.com/subscribe',
        listserv_token: process.env.LISTSERV_TOKEN || 'CHANGEME',
        logger: {
            silent: false,
            level: process.env.LOGLEVEL || 'info'
        },
        host: process.env.HOST || 'localhost',
        media_dir: '/usr/app/media',
        media_url: '/frontend/media',
        salt_rounds: 12,
        ttl: {
            access_token: 10 * 60, // 10 minutes
            mail_confirmation: 48 * 60 * 60, // 48 hours,
            mail_change: 48 * 60 * 60, // 48 hours,
            password_reset: 24 * 60 * 60 // 24 hours
        },
        filter_fields: [
            'token',
            'password',
            'postgres.password',
            'access_token',
            'refresh_token',
            'bugsnag_key',
            'cookie'
        ],
        bugsnag_key: process.env.BUGSNAG_KEY_CORE || 'CHANGEME'
    },
    development: {

    },
    test: {
        port: 8085,
        postgres: {
            host: 'localhost',
            database: 'core-testing'
        },
        logger: {
            silent: (typeof process.env.ENABLE_LOGGING !== 'undefined') ? (!process.env.ENABLE_LOGGING) : true
        },
        media_dir: './tmp_upload',
        salt_rounds: 4
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
    appConfig = merge(appConfig, config[env]);
}

module.exports = appConfig;
