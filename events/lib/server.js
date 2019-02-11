const express = require('express');
const bugsnag = require('bugsnag');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const boolParser = require('express-query-boolean');

const db = require('./sequelize');
const events = require('./events'); // API middlewares for events management
const applications = require('./applications'); // API middlewares for applications management
const imageserv = require('./imageserv');
const log = require('./logger');
const service = require('./service');
const middlewares = require('./middlewares');
const config = require('../config');

const EventsRouter = router({ mergeParams: true });
const GeneralRouter = router({ mergeParams: true });
const ImagesRouter = router({ mergeParams: true });

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
    bugsnag.register(config.bugsnagKey);
}

const server = express();
server.use(bodyParser.json());
server.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms,',
        req.user ? ('user ' + req.user.user.name + ' with id ' + req.user.id) : 'unauthorized'
    ].join(' ');
}, { stream: log.stream }));
server.use(boolParser());

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: ', err);

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
});

GeneralRouter.use(service.countRequests);
GeneralRouter.get('/status', service.status);

ImagesRouter.use(express.static(config.media_dir)); // Serving images.

GeneralRouter.use(middlewares.authenticateUser);

GeneralRouter.get('/', events.listEvents);
GeneralRouter.post('/', events.addEvent);

// Debugging requests, remove at some point in time
GeneralRouter.get('/getUser', service.getUser);

GeneralRouter.get('/mine/organizing', events.listUserOrganizedEvents);
GeneralRouter.get('/mine/participating', applications.listUserAppliedEvents);
GeneralRouter.get('/mine/approvable', events.listApprovableEvents);
GeneralRouter.get('/boardview/:body_id', events.listBodyApplications);

// All requests from here on use the getEvent middleware to fetch a single event from db
EventsRouter.use(middlewares.fetchSingleEvent);

EventsRouter.get('/', events.eventDetails);
EventsRouter.put('/', events.editEvent);
EventsRouter.delete('/', events.deleteEvent);
EventsRouter.put('/status', events.setApprovalStatus);
EventsRouter.get('/rights', events.getEditRights);
EventsRouter.post('/upload', imageserv.uploadImage);

EventsRouter.get('/applications', applications.listAllApplications);
EventsRouter.put('/applications/:application_id/status/', middlewares.fetchSingleApplication, applications.setApplicationStatus);
EventsRouter.put('/applications/:application_id/comment/', middlewares.fetchSingleApplication, applications.setApplicationComment);
EventsRouter.get('/applications/mine', applications.getApplication);
EventsRouter.put('/applications/mine', applications.setApplication);

EventsRouter.post('/organizers', events.addOrganizer);
EventsRouter.put('/organizers/:user_id', events.editOrganizer);
EventsRouter.delete('/organizers/:user_id', events.deleteOrganizer);

EventsRouter.post('/bodies', events.addLocal);
EventsRouter.delete('/bodies/:body_id', events.deleteLocal);

server.use(config.media_url, ImagesRouter);
server.use('/', GeneralRouter);
server.use('/single/:event_id', EventsRouter);

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
    /* istanbul ignore next */
        localApp.on('error', err => rej(new Error('Error starting server: ' + err.stack)));
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
