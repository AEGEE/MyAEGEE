const winston = require('winston');

const config = require('../config');

const logger = winston.createLogger({
    level: config.logger.level,
    silent: config.logger.silent,
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.align(),
                winston.format.splat(),
                winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`),
            )
        })
    ]
});

logger.stream = {
    write(message) {
        logger.info(message.substring(0, message.lastIndexOf('\n')));
    }
};

module.exports = logger;
