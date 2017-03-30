const restify = require('restify');
const events = require('./events.js'); // the real place where the API callbacks are
const applications = require('./applications.js'); // API callbacks for events applications
const lifecycle = require('./lifecycle.js'); // API callbacks for lifecycle managing
const imageserv = require('./imageserv.js');
const log = require('./config/logger.js');
const service = require('./service.js');
const middlewares = require('./middlewares.js');
const cron = require('./cron.js');
const config = require('./config/config.js');
const user = require('./user.js');
const bugsnag = require('bugsnag');

bugsnag.register(config.bugsnagKey);

const server = restify.createServer({
  name: 'oms-events',
  log,
});

server.use(restify.queryParser());
server.use(restify.jsonBodyParser());
server.use(restify.CORS());

// Define your API here

// this endpoint is for public access
// server.post({path: '/authenticate', version: '0.0.6'} , core.authenticate);

// for endpoints declared from here onwards, apply the middleware "verifyToken"
// server.use(core.verifyToken);

// Enable request logging
// server.pre((request, response, next) => {
//   log.info(request.method + ' ' + request.url);
//   return next();
// });

server.on('after', (req, res) => {
  try {
    log.info(`${req.method} ${req.url} - ${res._header.split('\n')[0]}`);
  } catch (err) {
    log.error('Error while logging: ', err);
  }
});

server.on('uncaughtException', (req, res, route, err) => {
  log.error(err);
  res.send(err);

  // We don't need the Bugsnag for the test env, do we?
  // Also Bugsnag should quit the process if some kind of error
  // will happen, and this will probably break the test environment.
  if (process.env.NODE_ENV !== 'test') {
    bugsnag.notify(err);
  }
});

// Everything (even the process errors) should be handled
// by the handler above.

/* process.on('uncaughtException', (err) => {
  log.error(err);
  console.log('process error');

  // If something goes wrong, the process will exit.
  // If the server is running with Mocha, the Mocha process
  // will silently exit without stack trace. That's why
  // this checking is still here.
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});*/

process.on('unhandledRejection', (err) => {
  log.error('Unhandled rejection: ', err);

  // Leaving severity as 'warning' by default, as it's not critical.
  if (process.env.NODE_ENV !== 'test') {
    bugsnag.notify(err, { errorName: 'unhandledRejection' });
  }
});

const curVersion = '0.0.1';

server.use(service.countRequests);
server.get({ path: '/registerMicroservice', version: curVersion }, service.registerMicroservice);
server.get({ path: '/ping', version: curVersion }, (req, res, next) => {
  res.send('pong');
  return next();
});

server.use(middlewares.authenticateUser);
server.use(middlewares.fetchUserDetails);

server.get({ path: '/', version: curVersion }, events.listEvents);
server.post({ path: '/', version: curVersion }, events.addEvent);

// Debugging requests, remove at some point in time
server.get({ path: '/status', version: curVersion }, service.status);
server.get({ path: '/debug', version: curVersion }, events.debug);
server.get({ path: '/getUser', version: curVersion }, [
  middlewares.checkPermissions,
  service.getUser,
]);

server.get({ path: '/lifecycle/names', version: curVersion }, lifecycle.getLifecyclesNames);
server.get({ path: '/lifecycle/pseudo', version: curVersion }, lifecycle.getPseudoRolesList);
server.post({ path: '/lifecycle', version: curVersion }, lifecycle.createLifecycle);
server.get({ path: '/lifecycle', version: curVersion }, lifecycle.getLifecycles);
server.del({ path: '/lifecycle/:lifecycle_id', version: curVersion }, lifecycle.removeLifecycle);

server.get({ path: '/eventroles', version: curVersion }, user.getEventRoles);

server.get({ path: '/mine/byOrganizer', version: curVersion }, events.listUserOrganizedEvents);
server.get({ path: '/mine/byApplication', version: curVersion }, applications.listUserAppliedEvents);
server.get({ path: '/mine/approvable', version: curVersion }, [
  middlewares.checkPermissions,
  events.listApprovableEvents,
]);

server.get({ path: '/boardview', version: curVersion }, [
  middlewares.checkPermissions,
  events.listLocalInvolvedEvents,
]);

// All requests from here on use the getEvent middleware to fetch a single event from db
server.use(middlewares.fetchSingleEvent);
server.use(middlewares.checkPermissions);

server.get({ path: '/single/:event_id', version: curVersion }, events.eventDetails);
server.put({ path: '/single/:event_id', version: curVersion }, events.editEvent);
server.del({ path: '/single/:event_id', version: curVersion }, events.deleteEvent);
server.get({ path: '/single/:event_id/status', version: curVersion }, events.listPossibleStatuses);
server.put({ path: '/single/:event_id/status', version: curVersion }, events.setApprovalStatus);
server.get({ path: '/single/:event_id/rights', version: curVersion }, events.getEditRights);
server.put({ path: '/single/:event_id/link', version: curVersion }, events.addEventLink);
server.post({ path: '/single/:event_id/upload', version: curVersion }, imageserv.uploadImage);

server.get({ path: '/single/:event_id/participants', version: curVersion },
           applications.listParticipants);
server.put({ path: '/single/:event_id/participants/status/:application_id', version: curVersion },
           applications.setApplicationStatus);
server.put({ path: '/single/:event_id/participants/comment/:application_id', version: curVersion },
           applications.setApplicationComment);
server.get({ path: '/single/:event_id/participants/mine', version: curVersion },
           applications.getApplication);
server.put({ path: '/single/:event_id/participants/mine', version: curVersion },
           applications.setApplication);

server.listen(config.port, () => {
  // try if there is a mongodb connection
  require('./config/options.js').then(() => {
    log.info('Up and running, %s listening on %s', server.name, server.url);
    cron.scanDB();
    user.updateEventRoles();
  });
});

module.exports = server;
