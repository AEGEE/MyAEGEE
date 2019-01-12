const express = require('express');
const bugsnag = require('bugsnag');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const boolParser = require('express-query-boolean');

const events = require('./events'); // API middlewares for events management
const applications = require('./applications'); // API middlewares for applications management
const imageserv = require('./imageserv');
const log = require('./config/logger');
const service = require('./service');
const middlewares = require('./middlewares');
const config = require('./config/config');

const EventsRouter = router({ mergeParams: true });
const GeneralRouter = router({ mergeParams: true });
const ImagesRouter = router({ mergeParams: true });

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
  bugsnag.register(config.bugsnagKey);
}

const server = express();
server.use(bodyParser.json());
server.use(morgan(':method :url :status - :response-time ms', { stream: log.stream }));
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
GeneralRouter.get('/boardview/:body_id', events.listLocalInvolvedEvents);

// All requests from here on use the getEvent middleware to fetch a single event from db
EventsRouter.use(middlewares.fetchSingleEvent);

EventsRouter.get('/', events.eventDetails);
EventsRouter.put('/', events.editEvent);
EventsRouter.delete('/', events.deleteEvent);
EventsRouter.get('/status', events.listPossibleStatuses);
EventsRouter.put('/status', events.setApprovalStatus);
EventsRouter.get('/rights', events.getEditRights);
EventsRouter.post('/upload', imageserv.uploadImage);

EventsRouter.get('/participants', applications.listParticipants);
EventsRouter.put('/participants/:application_id/status/', applications.setApplicationStatus);
EventsRouter.put('/participants/:application_id/comment/', applications.setApplicationComment);
EventsRouter.get('/participants/mine', applications.getApplication);
EventsRouter.put('/participants/mine', applications.setApplication);

EventsRouter.post('/organizers', events.addOrganizer);
EventsRouter.put('/organizers/:user_id', events.editOrganizer);
EventsRouter.delete('/organizers/:user_id', events.deleteOrganizer);

EventsRouter.post('/locals', events.addLocal);
EventsRouter.delete('/locals/:body_id', events.deleteLocal);

server.use(config.media_url, ImagesRouter);
server.use('/', GeneralRouter);
server.use('/single/:event_id', EventsRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

const app = server.listen(config.port, async () => {
  log.info('Up and running, listening on http://localhost:%d', config.port);
});

module.exports = app;
