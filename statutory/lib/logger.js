const bunyan = require('bunyan');

const config = require('../config');
const packageInfo = require('../package');

const logger = bunyan.createLogger({
    name: packageInfo.name,
    level: config.logger.silent ? bunyan.FATAL + 1 : config.logger.level
});

module.exports = logger;
