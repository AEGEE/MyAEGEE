const httprequest = require('request');
const restify = require('restify');

const config = require('./config/config.js');
const log = require('./config/logger.js');
const Event = require('./models/Event');
const UserCache = require('./models/UserCache');

exports.authenticateUser = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    log.info('Unauthenticated request', req);
    return next(new restify.ForbiddenError({
      body: {
        success: false,
        errors: [new Error('No auth token provided')],
        message: 'No auth token provided',
      },
    }));
  }

  return UserCache.findOne({ token }, (userCacheErr, userCacheRes) => {
    // If not found, query core
    if (userCacheErr || !userCacheRes) {
      return require('./config/options.js').then((options) => {
        const opts = {
          url: `${config.core.url}:${config.core.port}/api/getUserByToken`,
          method: 'POST',
          headers: options.getRequestHeaders(),
          form: {
            token,
          },
        };

        httprequest(opts, (requestError, requestResult, requestBody) => {
          if (requestError) {
            log.error('Could not contact core to authenticate user', requestError);
            return next(new restify.InternalError());
          }

          let body;
          try {
            body = JSON.parse(requestBody);
          } catch (err) {
            log.error('Could not parse core response', err);
            return next(new restify.InternalError());
          }

          if (!body.success) {
            log.info('Access denied to user', body);
            return next(new restify.ForbiddenError('Access denied'));
          }

          if (!req.user) {
            req.user = {};
          }
          req.user.basic = body.user;
          req.user.basic.antenna_name = body.user.antenna;

          // After calling next, try saving the fetched data to db
          if (config.enable_user_caching) {
            const saveUserData = new UserCache();
            saveUserData.token = token;
            saveUserData.user = req.user;
            saveUserData.save((saveErr) => {
              if (saveErr) {
                log.warn('Could not store user data in cache', saveErr);
              }
            });
          }

          return next();
        });
      });
    }

    // If found in cache, use that one
    if (!req.user) {
      req.user = {};
    }
    req.user = userCacheRes.user;
    return next();
  });
};

exports.fetchUserDetails = (req, res, next) => {
  // Check if authenticate user already fetched details from cache
  if (req.user.details) {
    return next();
  }

  return require('./config/options.js').then((options) => {
    const token = req.header('x-auth-token');
    if (!token) {
      log.info('Unauthenticated request', req);
      return next(new restify.ForbiddenError('No auth token provided'));
    }

    const opts = {
      url: `${config.core.url}:${config.core.port}/api/getUserProfile`,
      method: 'GET',
      headers: options.getRequestHeaders(token),
      qs: {
        is_ui: 0,
      },
    };

    return httprequest(opts, (requestError, requestResult, requestBody) => {
      if (requestError) {
        log.error('Could not fetch user profile details from core', requestError);
        return next(new restify.InternalError());
      }

      let body;
      try {
        body = JSON.parse(requestBody);
      } catch (err) {
        log.error('Could not parse core response', err);
        return next(new restify.InternalError());
      }

      if (!body.success) {
        log.info('Core refused user profile fetch', body);
        return next(new restify.ForbiddenError('Core refused user profile fetch'));
      }

      if (!req.user) {
        req.user = {};
      }
      req.user.details = body.user;
      req.user.workingGroups = body.workingGroups;
      req.user.board_positions = body.board_positions;
      req.user.roles = body.roles;
      req.user.fees_paid = body.fees_paid;

      req.user.special = ['Public'];

      if (req.user.basic.is_superadmin) {
        req.user.special.push('Superadmin');
      }
      if (req.user.board_positions.length > 0) {
        req.user.special.push('Board Member');
      }

      // Save fetched user details to cache
      if (config.enable_user_caching) {
        UserCache.findOne({ token: req.header('x-auth-token') }, (userCacheErr, userCacheRes) => {
          if (userCacheErr) {
            log.warn('Could not fetch user from cache', userCacheErr);
            return;
          }

          // Shouldn't happen
          if (!userCacheRes) {
            userCacheRes = new UserCache();
            res.token = req.header('x-auth-token');
          }

          userCacheRes.user = req.user;
          delete userCacheRes.user.permissions;
          userCacheRes.save((saveErr) => {
            if (saveErr) {
              log.warn('Could not store user data in cache', saveErr);
            }
          });
        });
      }

      return next();
    });
  });
};

exports.fetchSingleEvent = (req, res, next) => {
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

  return Event
    .findOne(findObject)
    .populate('status')
    .exec((err, event) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError({
          body: {
            success: false,
            errors: [err],
            message: err.message,
          },
        }));
      }

      if (event == null) {
        return next(new restify.NotFoundError({
          body: {
            success: false,
            errors: [new Error(`Event with id ${req.params.event_id} not found`)],
            message: `Event with id ${req.params.event_id} not found`,
          },
        }));
      }

      req.event = event;
      return next();
    });
};

// Middleware to check which permissions the user has, in regart to the current
// event if there is one Requires the fetchSingleEvent and fetchUserDetails
// middleware to be executed beforehand
exports.checkPermissions = (req, res, next) => {
  const permissions = {
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
    permissions.is.organizer =
      req.event.organizers.some(item => item.foreign_id === req.user.basic.id);

    let applicationIndex;

    permissions.is.participant = req.event.applications.some((item, index) => {
      if (item.foreign_id === req.user.basic.id) {
        applicationIndex = index;
        return true;
      }

      return false;
    });

    permissions.is.accepted_participant = permissions.is.participant &&
      req.event.applications[applicationIndex].application_status === 'accepted';

    permissions.is.own_antenna = req.event.organizing_locals.some(item =>
      item.foreign_id === req.user.basic.antenna_id);

    // TODO check if this is the right way to determine board positions

    permissions.can.edit_organizers = permissions.is.organizer;

    permissions.can.edit_details =
      (permissions.is.organizer &&
       req.event.application_status === 'closed' && req.event.status === 'draft') // Normal editing
      || permissions.is.superadmin;

    permissions.can.delete = req.event.status === 'draft' && permissions.can.edit_details;

    permissions.can.edit_application_status =
      (permissions.is.organizer && req.event.status === 'approved')
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
      (!permissions.is.organizer && req.event.application_status === 'open')
      || permissions.is.superadmin;

    permissions.can.approve_participants = permissions.is.organizer &&
      req.event.application_status === 'closed';

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
  for (const attr in permissions.is) {
    req.user.permissions.is[attr] = Boolean(permissions.is[attr]);
  }

  for (const attr in permissions.can) {
    req.user.permissions.can[attr] = Boolean(permissions.can[attr]);
  }

  return next();
};
