const express = require('express');
const bugsnag = require('bugsnag');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const config = require('../config');
const log = require('./logger');
const middlewares = require('./middlewares');
const db = require('./sequelize');
const events = require('./events');

const GeneralRouter = router({ mergeParams: true });
const EventsRouter = router({ mergeParams: true });

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

GeneralRouter.use(middlewares.authenticateUser);

GeneralRouter.get('/', events.listEvents);
GeneralRouter.post('/', events.addEvent);

EventsRouter.use(middlewares.fetchEvent);

EventsRouter.get('/', events.displayEvent);
EventsRouter.put('/', events.editEvent);

server.use('/', GeneralRouter);
server.use('/event/:event_id', EventsRouter);

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
        localApp.on('error', err => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    if (process.env.NODE_ENV !== 'test') await db.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
