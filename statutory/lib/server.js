const express = require('express');
const bugsnag = require('bugsnag');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const config = require('../config/config');
const log = require('./logger');
const middlewares = require('./middlewares');
const db = require('./sequelize');

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
    bugsnag.register(config.bugsnagKey);
}

const server = express();
server.use(bodyParser.json());
server.use(morgan(':method :url :status - :response-time ms', { stream: log.stream }));

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: ', err);

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
});

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

const app = server.listen(config.port, async () => {
    log.info('Up and running, listening on http://localhost:%d', config.port);
    await db.authenticate();
});

module.exports = app;
