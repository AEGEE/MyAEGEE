const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const boolParser = require('express-query-boolean');

const morgan = require('./morgan');
const db = require('./sequelize');
const events = require('./events'); // API middlewares for events management
const applications = require('./applications'); // API middlewares for applications management
const imageserv = require('./imageserv');
const log = require('./logger');
const middlewares = require('./middlewares');
const metrics = require('./metrics');
const endpointsMetrics = require('./endpoints_metrics');
const config = require('../config');
const Bugsnag = require('./bugsnag');

const EventsRouter = router({ mergeParams: true });
const GeneralRouter = router({ mergeParams: true });

const server = express();
server.use(bodyParser.json());
server.use(morgan);
server.use(boolParser());

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Unhandled rejection');

    if (process.env.NODE_ENV !== 'test') {
        Bugsnag.notify(err);
    }
});

GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.get('/metrics', metrics.getMetrics);
GeneralRouter.get('/metrics/requests', endpointsMetrics.getEndpointMetrics);

// For all the requests above these three, query the core for authorization data.
GeneralRouter.use(middlewares.authenticateUser);

GeneralRouter.get('/', events.listEvents);
GeneralRouter.post('/', middlewares.ensureAuthorized, events.addEvent);

GeneralRouter.get('/mine/organizing', middlewares.ensureAuthorized, events.listUserOrganizedEvents);
GeneralRouter.get('/mine/participating', middlewares.ensureAuthorized, events.listUserAppliedEvents);
GeneralRouter.get('/mine/approvable', middlewares.ensureAuthorized, events.listApprovableEvents);
GeneralRouter.get('/boardview/:body_id', middlewares.ensureAuthorized, events.listBodyApplications);

// All requests from here on use the getEvent middleware to fetch a single event from db
EventsRouter.use(middlewares.fetchSingleEvent);

// Getting the event details can be done without autorization.
EventsRouter.get('/', events.eventDetails);

// The next routes cannot.
EventsRouter.use(middlewares.ensureAuthorized);
EventsRouter.put('/', events.editEvent);
EventsRouter.delete('/', events.deleteEvent);
EventsRouter.put('/status', events.setApprovalStatus);
EventsRouter.post('/upload', imageserv.uploadImage);

EventsRouter.get('/applications', applications.listAllApplications);
EventsRouter.get('/applications/export', applications.exportAll);
EventsRouter.post('/applications', applications.createApplication);
EventsRouter.get('/applications/:application_id', middlewares.fetchSingleApplication, applications.getApplication);
EventsRouter.put('/applications/:application_id', middlewares.fetchSingleApplication, applications.updateApplication);
EventsRouter.put('/applications/:application_id/attended', middlewares.fetchSingleApplication, applications.setApplicationAttended);
EventsRouter.put('/applications/:application_id/confirmed', middlewares.fetchSingleApplication, applications.setApplicationConfirmed);
EventsRouter.put('/applications/:application_id/status', middlewares.fetchSingleApplication, applications.setApplicationStatus);
EventsRouter.put('/applications/:application_id/comment', middlewares.fetchSingleApplication, applications.setApplicationComment);

server.use(endpointsMetrics.addEndpointMetrics);
server.use('/', GeneralRouter);
server.use('/single/:event_id', EventsRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        log.info({ config }, 'Starting server with the following config');
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info({ host: 'http://localhost:' + config.port }, 'Up and running, listening');
            await db.authenticate();
            return res();
        });
        /* istanbul ignore next */
        localApp.on('error', (err) => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') await db.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
