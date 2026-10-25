const merge = require('../lib/merge');

const config = {
    default: {
        port: 8084,
        postgres: {
            host: process.env.DB_HOST || 'postgres-events',
            port: parseInt(process.env.DB_PORT, 10) || 5432,
            username: process.env.USERNAME || 'postgres',
            password: process.env.PG_PASSWORD || '5ecr3t',
            database: process.env.DB_DATABASE || 'events'
        },
        core: {
            url: 'http://core',
            port: 8084,
            user: {
                login: process.env.CORE_LOGIN || 'admin@example.com',
                password: process.env.CORE_PASSWORD || '5ecr3t5ecr3t'
            }
        },
        mailer: {
            url: 'http://mailer',
            port: 4000
        },
        new_event_notifications: [
            'events-approval@aegee.eu'
        ],
        // Extra recipients of the "new event submitted" mail, per event type.
        new_event_notifications_per_type: {
            nwm: ['netcom@aegee.eu']
        },
        logger: {
            silent: false,
            level: process.env.LOGLEVEL || 'info'
        },
        host: process.env.HOST || 'localhost',
        bugsnagKey: process.env.BUGSNAG_KEY || '',
        media_dir: '/usr/app/media',
        media_url: '/frontend/media',
    },
    development: {

    },
    // End-to-end tests: services run as plain Node processes on localhost (see e2e/README.md).
    e2e: {
        port: 18085,
        postgres: {
            host: process.env.DB_HOST || 'localhost',
            username: process.env.DB_USERNAME || 'postgres',
            database: 'events-e2e'
        },
        core: {
            url: 'http://localhost',
            port: 18084
        },
        mailer: {
            url: 'http://localhost',
            port: 18090
        },
        logger: {
            level: process.env.LOGLEVEL || 'warn'
        },
        bugsnagKey: '00000000000000000000000000000000', // valid format; reporting is disabled in e2e
        media_dir: '/tmp/myaegee-e2e/events-media'
    },
    test: {
        port: 8085,
        postgres: {
            host: 'localhost',
            database: 'events-testing'
        },
        logger: {
            silent: (typeof process.env.ENABLE_LOGGING !== 'undefined') ? (!process.env.ENABLE_LOGGING) : true
        },
        bugsnagKey: 'CHANGEME',
        media_dir: './tmp_upload'
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
