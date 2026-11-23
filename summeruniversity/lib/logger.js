const bunyan = require('bunyan');

const config = require('../config');
const packageInfo = require('../package.json');

const logger = bunyan.createLogger({
    name: packageInfo.name,
    level: config.logger.silent ? bunyan.FATAL + 1 : config.logger.level,
    // Errors keep their message, name and stack. Their other properties, such as
    // the values of a failed database query, can hold personal data.
    serializers: { err: bunyan.stdSerializers.err }
});

module.exports = logger;
