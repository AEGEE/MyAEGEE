var config = require('./config/config.js');
var log = require('./config/logger.js');
var httprequest = require('request');
var mongoose = require('./config/mongo.js');
var restify = require('restify');
var Event = require('./eventModel.js');

// For each request, query the core for user data
// Cache user auth data so we don't have to query the core on each call
var userCacheSchema = mongoose.Schema({
  user: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, expires: 300, default: Date.now },
  token: { type: String, required: true, index: true },
});
var UserCache = mongoose.model('UserCache', userCacheSchema);

exports.authenticateUser = (req, res, next) => {
  var token = req.header('x-auth-token');
  if (!token) {
    // log.info("Unauthenticated request", req);
    return next(new restify.ForbiddenError('No auth token provided'));
  }

  UserCache.findOne({ token: token }, (userCacheErr, userCacheRes) => {
    // If not found, query core
    if (userCacheErr || !userCacheRes) {
      require('./config/options.js').then((options) => {
        var opts = {
          url: config.core.url + ':' + config.core.port + '/api/getUserByToken',
          method: 'POST',
          headers: options.getRequestHeaders(),
          form: {
            token: token,
          },
        };

        httprequest(opts, (err, res, body) => {
          if (err) {
            log.error('Could not contact core to authenticate user', err);
            return next(new restify.InternalError);
          }

          try {
            body = JSON.parse(body);
          }
          catch (err) {
            log.error('Could not parse core response', err);
            return next(new restify.InternalError());
          }

          if (!body.success) {
            log.info('Access denied to user', body);
            return next(new restify.ForbiddenError('Access denied'));
          }

          if (!req.user)
            req.user = {};
          req.user.basic = body.user;
          req.user.basic.antenna_name = body.user.antenna;
          next();

          // After calling next, try saving the fetched data to db
          if (config.enable_user_caching) {
            var saveUserData = new UserCache();
            saveUserData.token = token;
            saveUserData.user = req.user;
            saveUserData.save((err) => {
              if (err)
                log.warn('Could not store user data in cache', err);
            });
          }
        });
      });
    }

    // If found in cache, use that one
    else {
      if (!req.user)
        req.user = {};
      req.user = userCacheRes.user;
      return next();
    }
  });

};

exports.fetchUserDetails = function (req, res, next) {
  // Check if authenticate user already fetched details from cache
  if (req.user.details)
    return next();

  require('./config/options.js').then(options => {

    var token = req.header('x-auth-token');
    if (!token) {
      log.info('Unauthenticated request', req);
      return next(new restify.ForbiddenError('No auth token provided'));
    }

    var opts = {
      url: config.core.url + ':' + config.core.port + '/api/getUserProfile',
      method: 'GET',
      headers: options.getRequestHeaders(token),
      qs: {
        is_ui: 0,
      },
    };

    httprequest(opts, function (err, res, body) {
      if (err) {
        log.error('Could not fetch user profile details from core', err);
        return next(new restify.InternalError);
      }

      try {
        body = JSON.parse(body);
      }
      catch (err) {
        log.error('Could not parse core response', err);
        return next(new restify.InternalError());
      }

      if (!body.success) {
        log.info('Core refused user profile fetch', body);
        return next(new restify.ForbiddenError('Core refused user profile fetch'));
      }

      if (!req.user)
        req.user = {};
      req.user.details = body.user;
      req.user.workingGroups = body.workingGroups;
      req.user.board_positions = body.board_positions;
      req.user.roles = body.roles;
      req.user.fees_paid = body.fees_paid;

      req.user.special = ['Public'];

      next();

      // Save fetched user details to cache
      if (config.enable_user_caching) {
        UserCache.findOne({ token: req.header('x-auth-token') }, function (err, res) {
          if (err) {
            log.warn('Could not fetch user from cache', err);
            return;
          }

          // Shouldn't happen
          if (!res) {
            res = new UserCache();
            res.token = req.header('x-auth-token');
          }

          res.user = req.user;
          delete res.user.permissions;
          res.save(err => {
            if (err)
              log.warn('Could not store user data in cache', err);
          });
        });
      }
    });
  });
};

exports.fetchSingleEvent = function (req, res, next) {
  if (!req.params.event_id) {
    log.info(req.params);
    return next(new restify.NotFoundError('No Event-id provided'));
  }

  Event
    .findById(req.params.event_id)
    .populate('status')
    .exec(function (err, event) {
    if (err) {
      if (err.name == 'CastError')
        return next(new restify .NotFoundError(
          'Event with id ' + req.params.event_id + ' not found'));
      log.info(err);
      return next(new restify.InternalError());
    }

    if (event == null)
      return next(new restify.NotFoundError('Event with id ' + req.params.event_id + ' not found'));

    req.event = event;
    return next();
  });
};

// Middleware to check which permissions the user has, in regart to the current
// event if there is one Requires the fetchSingleEvent and fetchUserDetails
// middleware to be executed beforehand
exports.checkPermissions = (req, res, next) => {
  var permissions = {
    is: {},
    can: {},
  };

  permissions.is.superadmin = req.user.basic.is_superadmin;

  // If user details are available, fill additional roles
  if (req.user.details) {
    permissions.is.boardmember = req.user.board_positions.length > 0;

    permissions.can.view_local_involved_events = permissions.is.boardmember ||
      permissions.is.superadmin;
  }

  // If an event was fetched, add event-based permissions
  if (req.event) {
    permissions.is.organizer = req.event.organizers.some(function (item) {
      return item.foreign_id == req.user.basic.id;
    });

    var application_index;

    permissions.is.participant = req.event.applications.some(function (item, index) {
      if (item.foreign_id === req.user.basic.id) {
        application_index = index;
        return true;
      }

      return false;
    });

    permissions.is.accepted_participant = permissions.is.participant &&
      req.event.applications[application_index].application_status === 'accepted';

    permissions.is.own_antenna = req.event.organizing_locals.some(item =>
      item.foreign_id === req.user.basic.antenna_id);

    // TODO check if this is the right way to determine board positions

    permissions.can.edit_organizers = permissions.is.organizer;

    permissions.can.edit_details =
      (permissions.is.organizer &&
       req.event.application_status == 'closed' && req.event.status == 'draft') // Normal editing
      || permissions.is.superadmin;

    permissions.can.delete = req.event.status == 'draft' && permissions.can.edit_details;

    permissions.can.edit_application_status =
      (permissions.is.organizer && req.event.status == 'approved')
      || permissions.is.superadmin;

    // TODO: probably remove this one, since we have the lifecycle workflow
    permissions.can.approve =
      req.event.application_status === 'closed' || permissions.is.superadmin;

    permissions.can.edit =
      permissions.can.edit_details
      || permissions.can.edit_organizers
      || permissions.can.delete
      || permissions.can.edit_application_status
      || permissions.can.approve;

    permissions.can.apply =
      (!permissions.is.organizer && req.event.application_status == 'open')
      || permissions.is.superadmin;

    permissions.can.approve_participants = permissions.is.organizer &&
      req.event.application_status == 'closed';

    permissions.can.view_applications =
      permissions.is.organizer
      || (permissions.is.boardmember && permissions.is.own_antenna)
      || permissions.is.superadmin;
  }

  if (permissions.is.organizer) {
    req.user.special.push('Organizer');
  }

  // Convert all to boolean and assign
  req.user.permissions = { is: {}, can: {} };
  for (var attr in permissions.is) {
    req.user.permissions.is[attr] = Boolean(permissions.is[attr]);
  }

  for (var attr in permissions.can) {
    req.user.permissions.can[attr] = Boolean(permissions.can[attr]);
  }

  return next();
};
