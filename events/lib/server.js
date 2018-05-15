const express = require('express');
const bugsnag = require('bugsnag');
const router = require('express-promise-router');
const bodyParser = require('body-parser');

const events = require('./events'); // API middlewares for events management
const lifecycle = require('./lifecycle'); // API middlewares for lifecycle managing
const applications = require('./applications'); // API middlewares for applications management
const imageserv = require('./imageserv');
const log = require('./config/logger');
const service = require('./service');
const middlewares = require('./middlewares');
const cron = require('./cron');
const config = require('./config/config');
const user = require('./user');

const EventsRouter = router({ mergeParams: true });
const GeneralRouter = router({ mergeParams: true });

if (process.env.NODE_ENV !== 'test') {
  bugsnag.register(config.bugsnagKey);
}

const server = express();
server.use(bodyParser.json());

server.on('after', (req, res) => {
  try {
    log.info(`${req.method} ${req.url} - ${res._header.split('\n')[0]}`);
  } catch (err) {
    log.error('Error while logging: ', err);
  }
});

process.on('unhandledRejection', (err) => {
  log.error('Unhandled rejection: ', err);

  // Leaving severity as 'warning' by default, as it's not critical.
  if (process.env.NODE_ENV !== 'test') {
    bugsnag.notify(err, { errorName: 'unhandledRejection' });
  }
});

GeneralRouter.use(service.countRequests);

GeneralRouter.get('/status', service.status);

GeneralRouter.use(middlewares.authenticateUser);
GeneralRouter.use(middlewares.checkPermissions);

GeneralRouter.get('/', events.listEvents);
GeneralRouter.post('/', events.addEvent);

// Debugging requests, remove at some point in time
GeneralRouter.get('/debug', events.debug);
GeneralRouter.get('/getUser', service.getUser);

GeneralRouter.get('/lifecycle/names', lifecycle.getLifecyclesNames);
GeneralRouter.get('/lifecycle/pseudo', lifecycle.getPseudoRolesList);
GeneralRouter.get('/lifecycle', lifecycle.getLifecycles);
GeneralRouter.post('/lifecycle', lifecycle.createLifecycle);
GeneralRouter.delete('/lifecycle/:lifecycle_id', lifecycle.removeLifecycle);

GeneralRouter.get('/eventroles', user.getEventRoles);

GeneralRouter.get('/mine/byOrganizer', events.listUserOrganizedEvents);
GeneralRouter.get('/mine/approvable', events.listApprovableEvents);

/* server.get('/boardview', events.listLocalInvolvedEvents); */

// All requests from here on use the getEvent middleware to fetch a single event from db
EventsRouter.use(middlewares.fetchSingleEvent);
EventsRouter.use(middlewares.checkEventPermissions);

EventsRouter.get('/', events.eventDetails);
EventsRouter.put('/', events.editEvent);
EventsRouter.delete('/', events.deleteEvent);
EventsRouter.get('/status', events.listPossibleStatuses);
EventsRouter.put('/status', events.setApprovalStatus);
EventsRouter.get('/rights', events.getEditRights);
EventsRouter.put('/link', events.addEventLink);
EventsRouter.post('/upload', imageserv.uploadImage);

EventsRouter.get('/participants', applications.listParticipants);
EventsRouter.put('/participants/:application_id/status/', applications.setApplicationStatus);
EventsRouter.put('/participants/:application_id/comment/', applications.setApplicationComment);
EventsRouter.get('/participants/mine', applications.getApplication);
EventsRouter.put('/participants/mine', applications.setApplication);

server.use('/', GeneralRouter);
server.use('/single/:event_id', EventsRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

const app = server.listen(config.port, () => {
  log.info('Up and running, %s listening on %s', server.name, server.url);
  cron.scanDB();
  user.updateEventRoles();
});

module.exports = app;
