const express = require('express');
const bugsnag = require('bugsnag');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const config = require('../config');
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
    log.error('Unhandled rejection: %s', err.stack);

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
});

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info('Up and running, listening on http://localhost:%d', config.port);
            await db.authenticate();
            return res();
        });
        localApp.on('close', async () => {
            log.info('Shutting down server...');
            await db.close();
        });
        localApp.on('error', err => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
