const config = require('./index');

// Workaround for running Sequelize migrations
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const env = process.env.NODE_ENV;

const object = config.postgres;
object.dialect = 'postgres';

module.exports[env] = object;
