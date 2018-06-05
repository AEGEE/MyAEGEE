const Sequelize = require('sequelize');

const logger = require('./logger');
const config = require('../config/config');

const requiredFields = ['database', 'username', 'password', 'host', 'port'];
for (const field of requiredFields) {
    if (typeof config.postgres[field] === undefined) { // if var is set
        logger.error('Missing config field: config.postgres.%s', field);
        process.exit(1);
    }
}

const sequelize = new Sequelize(config.postgres.database, config.postgres.username, config.postgres.password, {
    host: config.postgres.host,
    port: config.postgres.port,
    dialect: 'postgres',
    operatorsAliases: false,
    logging: logger.debug
});

exports.sequelize = sequelize;
exports.Sequelize = Sequelize;

exports.authenticate = () => sequelize.authenticate().then(() => {
    logger.info(
        'Connected to PostgreSQL at postgres://%s:%s/%s',
        config.postgres.host,
        config.postgres.port,
        config.postgres.database
    );
}).catch((err) => {
    logger.error('Unable to connect to the database: %s', err);
    process.exit(1);
});
