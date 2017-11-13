const restify = require('restify');
const bugsnag = require('bugsnag');
const wrap = require('@gilbertco/restify-async-wrap');

const events = require('./events.js'); // the real place where the API callbacks are
const lifecycle = require('./lifecycle.js'); // API callbacks for lifecycle managing
const imageserv = require('./imageserv.js');
const log = require('./config/logger.js');
const service = require('./service.js');
const middlewares = require('./middlewares.js');
const cron = require('./cron.js');
const config = require('./config/config.js');
const user = require('./user.js');

if (process.env.NODE_ENV !== 'test') {
  bugsnag.register(config.bugsnagKey);
}

const server = restify.createServer({
  name: 'oms-events',
  log,
});

server.use(restify.queryParser());
server.use(restify.jsonBodyParser());
server.use(restify.CORS());

// Define your API here

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
  log.error(err.stack);
  res.json({
    success: false,
    message: err.message
  });

  // We don't need the Bugsnag for the test env, do we?
  // Also Bugsnag should quit the process if some kind of error
  // will happen, and this will probably break the test environment.
  if (process.env.NODE_ENV !== 'test') {
    bugsnag.notify(err);
  }
});

process.on('unhandledRejection', (err) => {
  log.error('Unhandled rejection: ', err);

  // Leaving severity as 'warning' by default, as it's not critical.
  if (process.env.NODE_ENV !== 'test') {
    bugsnag.notify(err, { errorName: 'unhandledRejection' });
  }
});

const curVersion = '0.0.1';

server.use(service.countRequests);
server.get({ path: '/ping', version: curVersion }, (req, res, next) => {
  res.send('pong');
  return next();
});

server.use(wrap(middlewares.authenticateUser));

server.get({ path: '/', version: curVersion }, wrap(events.listEvents));
server.post({ path: '/', version: curVersion }, wrap(events.addEvent));

// Debugging requests, remove at some point in time
server.get({ path: '/status', version: curVersion }, service.status);
server.get({ path: '/debug', version: curVersion }, events.debug);
server.get({ path: '/getUser', version: curVersion }, [
  // middlewares.checkPermissions,
  wrap(service.getUser),
]);

server.get({ path: '/lifecycle/names', version: curVersion }, wrap(lifecycle.getLifecyclesNames));
server.get({ path: '/lifecycle/pseudo', version: curVersion }, wrap(lifecycle.getPseudoRolesList));
server.get({ path: '/lifecycle', version: curVersion }, wrap(lifecycle.getLifecycles));
server.post({ path: '/lifecycle', version: curVersion }, wrap(middlewares.checkPermissions), wrap(lifecycle.createLifecycle));
server.del({ path: '/lifecycle/:lifecycle_id', version: curVersion }, wrap(middlewares.checkPermissions), wrap(lifecycle.removeLifecycle));

server.get({ path: '/eventroles', version: curVersion }, wrap(user.getEventRoles));

server.get({ path: '/mine/byOrganizer', version: curVersion }, wrap(events.listUserOrganizedEvents));
server.get({ path: '/mine/approvable', version: curVersion }, [
  wrap(middlewares.checkPermissions),
  wrap(events.listApprovableEvents),
]);

/* server.get({ path: '/boardview', version: curVersion }, [
  wrap(middlewares.checkPermissions),
  wrap(events.listLocalInvolvedEvents),
]); */

// All requests from here on use the getEvent middleware to fetch a single event from db
server.use(wrap(middlewares.fetchSingleEvent));
server.use(wrap(middlewares.checkPermissions));

server.get({ path: '/single/:event_id', version: curVersion }, wrap(events.eventDetails));
server.put({ path: '/single/:event_id', version: curVersion }, wrap(events.editEvent));
server.del({ path: '/single/:event_id', version: curVersion }, wrap(events.deleteEvent));
server.get({ path: '/single/:event_id/status', version: curVersion }, wrap(events.listPossibleStatuses));
server.put({ path: '/single/:event_id/status', version: curVersion }, wrap(events.setApprovalStatus));
server.get({ path: '/single/:event_id/rights', version: curVersion }, wrap(events.getEditRights));
server.put({ path: '/single/:event_id/link', version: curVersion }, wrap(events.addEventLink));
server.post({ path: '/single/:event_id/upload', version: curVersion }, wrap(imageserv.uploadImage));

server.listen(config.port, () => {
  // try if there is a mongodb connection
  log.info('Up and running, %s listening on %s', server.name, server.url);
  cron.scanDB();
  user.updateEventRoles();
});

module.exports = server;
