const request = require('request-promise-native');
const restify = require('restify');

const config = require('./config/config.js');
const log = require('./config/logger.js');
const Event = require('./models/Event');
const UserCache = require('./models/UserCache');
const helpers = require('./helpers.js');
const communication = require('./communication');
const user = require('./user.js');

exports.authenticateUser = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return next(new restify.ForbiddenError({ body: {
      success: false,
      message: 'No auth token provided'
    } }));
  }


  try {
    // Find the core service
    const service = await communication.getServiceByName('omscore-nginx');

    // Get the request headers to send an auth token
    const headers = await communication.getRequestHeaders(req);

    // Query the core
    const body = await request({
      url: `${service.backend_url}api/tokens/user`,
      method: 'POST',
      headers,
      form: {
        token: headers['X-Auth-Token'],
      },
      json: true,
    });

    if (!body.success) {
      // We are not authenticated
      throw new Error('User not authenticated');
    }

    if (!req.user) {
      req.user = body.data;
    }

    if (!req.user.special) {
      req.user.special = ['Public']; // Everybody is included in 'Public', right?
    }

    return next();
  } catch (err) {
    throw err;
  }
};

exports.fetchSingleEvent = async (req, res, next) => {
  if (!req.params.event_id) {
    log.info(req.params);
    return next(new restify.NotFoundError('No Event-id provided'));
  }

  // Checking if the passed ID is ObjectID or not.
  // We don't use ObjectID.isValid method, since it's not always
  // working properly, see http://stackoverflow.com/a/29231016/1206421
  let findObject;
  if (req.params.event_id.match(/^[0-9a-fA-F]{24}$/)) { // if it's indeed an ObjectID
    findObject = { _id: req.params.event_id };
  } else {
    findObject = { url: req.params.event_id };
  }

  try {
    const event = await Event.findOne(findObject);

    if (event === null) {
      return next(new restify.NotFoundError({
        body: {
          success: false,
          message: `Event with id ${req.params.event_id} not found`,
        },
      }));
    }

    req.event = event;
    return next();
  } catch (err) {
    log.error('Error getting single event: ', err);
    return next(new restify.InternalError({
      body: {
        success: false,
        message: err.message,
      },
    }));
  }
};

// Middleware to check which permissions the user has, in regart to the current
// event if there is one Requires the fetchSingleEvent and fetchUserDetails
// middleware to be executed beforehand
exports.checkPermissions = async (req, res, next) => {
  const permissions = {
    is: {},
    can: {},
  };

  permissions.is.superadmin = req.user.is_superadmin;

  // If user details are available, fill additional roles
  if (req.user.details) {
    // TODO check if this is the right way to determine board positions
    permissions.is.boardmember = req.user.board_positions.length > 0;

    permissions.can.view_local_involved_events = permissions.is.boardmember ||
      permissions.is.superadmin;
  }

  const eventPermissions = helpers.getEventPermissions(req.event, req.user);

  // Convert all to boolean and assign
  req.user.permissions = { is: {}, can: {} };
  for (const attr in permissions.is) {
    req.user.permissions.is[attr] = Boolean(permissions.is[attr]);
  }
  for (const attr in permissions.can) {
    req.user.permissions.can[attr] = Boolean(permissions.can[attr]);
  }
  for (const attr in eventPermissions.is) {
    req.user.permissions.is[attr] = Boolean(eventPermissions.is[attr]);
  }
  for (const attr in eventPermissions.can) {
    req.user.permissions.can[attr] = Boolean(eventPermissions.can[attr]);
  }
  if (eventPermissions.special) {
    Array.prototype.push.apply(req.user.special, eventPermissions.special);
  }

  // Filter out links
  if (req.event) {
    req.event.links = req.event.links.filter(link =>
      helpers.canUserAccess(req.user, link.visibility));
  }

  return next();
};
