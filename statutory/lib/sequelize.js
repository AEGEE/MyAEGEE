require('pg').defaults.parseInt8 = true; // to return count() as int, not string

const Sequelize = require('sequelize');

const logger = require('./logger');
const config = require('../config');

// not using helpers.isDefined() here because of the circular dependency caching issues
const requiredFields = ['database', 'username', 'password', 'host', 'port'];
for (const field of requiredFields) {
    if (typeof config.postgres[field] === 'undefined') { // if var is set
        logger.error('Missing config field: config.postgres.%s', field);
        process.exit(1);
    }
}

Sequelize.postgres.DECIMAL.parse = value => parseFloat(value);

const getSequelize = () => new Sequelize(config.postgres.database, config.postgres.username, config.postgres.password, {
    host: config.postgres.host,
    port: config.postgres.port,
    dialect: 'postgres',
    logging: sql => logger.debug(sql),
});

let sequelize = getSequelize();

exports.sequelize = sequelize;
exports.Sequelize = Sequelize;

exports.authenticate = async () => {
    if (!sequelize) {
        sequelize = getSequelize();
    }

    try {
        await sequelize.authenticate();
        logger.info(
            'Connected to PostgreSQL at postgres://%s:%s/%s',
            config.postgres.host,
            config.postgres.port,
            config.postgres.database
        );
    } catch (err) {
        logger.error('Unable to connect to the database: %s', err);
        process.exit(1);
    }
};

exports.close = async () => {
    logger.info('Closing PostgreSQL connection...');
    await sequelize.close();
    sequelize = null;
};
