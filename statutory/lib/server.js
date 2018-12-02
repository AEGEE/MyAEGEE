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
const applications = require('./applications');
const memberslists = require('./memberslists');
const massmailer = require('./massmailer');
const paxLimits = require('./pax_limits');

const GeneralRouter = router({ mergeParams: true });
const PaxLimitsRouter = router({ mergeParams: true });
const EventsRouter = router({ mergeParams: true });
const ApplicationsRouter = router({ mergeParams: true });
const SingleApplicationRouter = router({ mergeParams: true });
const MembersListsRouter = router({ mergeParams: true });
const MassMailerRouter = router({ mergeParams: true });

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

PaxLimitsRouter.use(middlewares.authenticateUser, paxLimits.checkEventType);
PaxLimitsRouter.get('/:body_id', paxLimits.getSingleLimit);
PaxLimitsRouter.delete('/:body_id', paxLimits.deleteSingleLimit);
PaxLimitsRouter.post('/', paxLimits.updateLimit);
PaxLimitsRouter.get('/', paxLimits.listAllLimits);

EventsRouter.use(middlewares.authenticateUser, middlewares.fetchEvent);
EventsRouter.get('/', events.displayEvent);
EventsRouter.put('/', events.editEvent);
EventsRouter.put('/status', events.changeEventStatus);

ApplicationsRouter.use(middlewares.authenticateUser, middlewares.fetchEventWithApplications);
ApplicationsRouter.post('/', applications.postApplication);
ApplicationsRouter.get('/all', applications.listAllApplications);
ApplicationsRouter.get('/stats', applications.getStats);
ApplicationsRouter.get('/export/openslides', applications.exportOpenslides);
ApplicationsRouter.get('/export/all', applications.exportAll);
ApplicationsRouter.get('/accepted', applications.listAcceptedApplications);
ApplicationsRouter.get('/boardview/:body_id', applications.listBoardView);

SingleApplicationRouter.use(middlewares.authenticateUser, middlewares.fetchEvent, middlewares.fetchSingleApplication);
SingleApplicationRouter.put('/cancel', applications.setApplicationCancelled);
SingleApplicationRouter.put('/attended', applications.setApplicationAttended);
SingleApplicationRouter.put('/departed', applications.setApplicationDeparted);
SingleApplicationRouter.put('/paid_fee', applications.setApplicationPaidFee);
SingleApplicationRouter.put('/status', applications.setApplicationStatus);
SingleApplicationRouter.put('/board', applications.setApplicationBoard);
SingleApplicationRouter.get('/', applications.getApplication);
SingleApplicationRouter.put('/', applications.updateApplication);

MembersListsRouter.use(middlewares.authenticateUser, middlewares.fetchEvent, memberslists.checkIfAgora);
MembersListsRouter.get('/', memberslists.getAllMemberslists);
MembersListsRouter.get('/:body_id', memberslists.getMemberslist);
MembersListsRouter.post('/:body_id', memberslists.uploadMembersList);

MembersListsRouter.use(middlewares.authenticateUser, middlewares.fetchEvent);
MembersListsRouter.get('/', memberslists.getAllMemberslists);
MembersListsRouter.get('/:body_id', memberslists.getMemberslist);
MembersListsRouter.post('/:body_id', memberslists.uploadMembersList);

MassMailerRouter.use(middlewares.authenticateUser, middlewares.fetchEventWithApplications);
MassMailerRouter.post('/', massmailer.sendAll);
MassMailerRouter.post('/:filter', massmailer.sendAll);

server.use('/events/:event_id/massmailer', MassMailerRouter);
server.use('/events/:event_id/memberslists', MembersListsRouter);
server.use('/events/:event_id/applications', ApplicationsRouter);
server.use('/events/:event_id/applications/:application_id', SingleApplicationRouter);
server.use('/events/:event_id', EventsRouter);
server.use('/limits/:event_type', PaxLimitsRouter);
server.use('/', GeneralRouter);

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
