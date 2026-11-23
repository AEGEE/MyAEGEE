const express = require('express');
const qs = require('qs');
const cors = require('cors');
const bodyParser = require('body-parser');

const queryBoolean = require('./query-boolean');
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

const EventsRouter = express.Router({ mergeParams: true });
const GeneralRouter = express.Router({ mergeParams: true });

const server = express();
// Express 5 defaults to the 'simple' query parser, and its 'extended' parser
// lowers qs's array limit to 20. Keep Express 4's behaviour: nested and bracketed
// parameters (filter[status]=..., type[]=...) with up to 1000 array items.
server.set('query parser', (str) => qs.parse(str, { allowPrototypes: true, arrayLimit: 1000 }));
server.use(bodyParser.json());
server.use(morgan);
server.use(queryBoolean());

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Unhandled rejection');

    if (process.env.NODE_ENV !== 'test') {
        Bugsnag.notify(err);
    }
});

const corsOptions = {
    origin: [/aegee\.eu|aegee\.org|app\.aegee-leiden\.nl/]
};

GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.get('/metrics', metrics.getMetrics);
GeneralRouter.get('/metrics/requests', endpointsMetrics.getEndpointMetrics);

// For all the requests above these three, query the core for authorization data.
GeneralRouter.use(middlewares.authenticateUser);

GeneralRouter.get('/', cors(corsOptions), events.listEvents);
GeneralRouter.post('/', middlewares.ensureAuthorized, events.addEvent);

GeneralRouter.get('/mine/organizing', middlewares.ensureAuthorized, events.listUserOrganizedEvents);
GeneralRouter.get('/mine/participating', middlewares.ensureAuthorized, events.listUserAppliedEvents);
GeneralRouter.get('/mine/approvable', middlewares.ensureAuthorized, events.listApprovableEvents);
GeneralRouter.get('/boardview/:body_id', middlewares.ensureAuthorized, events.listBodyApplications);
GeneralRouter.get('/applications/future/:user_id', middlewares.ensureAuthorized, applications.listFutureApplicationsForUser);

GeneralRouter.get('/recents', middlewares.ensureAuthorized, events.listMostRecentEuropeanEvents);

// All requests from here on use the getEvent middleware to fetch a single event from db
EventsRouter.use(middlewares.fetchSingleEvent);

// Getting the event details can be done without autorization.
EventsRouter.get('/', cors(corsOptions), events.eventDetails);

// The next routes cannot.
EventsRouter.use(middlewares.ensureAuthorized);
EventsRouter.put('/', events.editEvent);
EventsRouter.delete('/', events.deleteEvent);
EventsRouter.put('/status', events.setApprovalStatus);
EventsRouter.post('/upload', imageserv.uploadImage);
EventsRouter.put('/status/european_event', events.setEuropeanEventStatus);

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
server.use('/', endpointsMetrics.recordMountPath('/'), GeneralRouter);
server.use('/single/:event_id', endpointsMetrics.recordMountPath('/single/:event_id'), EventsRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        // Host, port and environment only: the configuration holds passwords and keys.
        log.info({ host: config.host, port: config.port, env: process.env.NODE_ENV }, 'Starting server');
        const localApp = server.listen(config.port, async (err) => {
            // Express 5 also calls this on startup errors (EADDRINUSE etc.).
            if (err) return rej(err);
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
