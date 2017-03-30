const httprequest = require('request');
const restify = require('restify');

const config = require('./config/config.js');
const log = require('./config/logger.js');
const Event = require('./models/Event');
const UserCache = require('./models/UserCache');
const helpers = require('./helpers.js');
const user = require('./user.js');

exports.authenticateUser = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    log.info('Unauthenticated request', req);
    return next(new restify.ForbiddenError({
      body: {
        success: false,
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
            return next(new restify.InternalError({
              body: {
                success: false,
                message: requestError.message,
              },
            }));
          }

          let body;
          try {
            body = JSON.parse(requestBody);
          } catch (err) {
            log.error('Could not parse core response', err);
            return next(new restify.InternalError({
              body: {
                success: false,
                err: err.message,
              },
            }));
          }

          if (!body.success) {
            log.info('Access denied to user', body);
            return next(new restify.ForbiddenError({
              body: {
                success: false,
                message: 'Access denied',
              },
            }));
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
            saveUserData.foreign_id = req.user.basic.id;
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
        return next(new restify.InternalError({
          body: {
            success: false,
            message: `Could not fetch user profile details from core: ${requestError}`,
          },
        }));
      }

      let body;
      try {
        body = JSON.parse(requestBody);
      } catch (err) {
        log.error('Could not parse core response', err);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: `Could not parse core response: ${err}`,
          },
        }));
      }

      if (!body.success) {
        log.info('Core refused user profile fetch', body);
        return next(new restify.ForbiddenError({
          body: {
            success: false,
            message: 'Core refused user profile fetch',
          },
        }));
      }

      if (!req.user) {
        req.user = {};
      }
      req.user.details = body.user;
      req.user.workingGroups = body.workingGroups;
      req.user.board_positions = body.board_positions;
      req.user.roles = body.roles;
      req.user.fees_paid = body.fees_paid;

      // Special roles
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
          userCacheRes.foreign_id = req.user.basic.id;
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
    .populate('organizers.roles')
    .populate('organizers.cached')
    .exec((err, event) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: err.message,
          },
        }));
      }

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
    // TODO check if this is the right way to determine board positions
    permissions.is.boardmember = req.user.board_positions.length > 0;

    permissions.can.view_local_involved_events = permissions.is.boardmember ||
      permissions.is.superadmin;
  }

  const event_permissions = helpers.getEventPermissions(req.event, req.user);

  // Convert all to boolean and assign
  req.user.permissions = { is: {}, can: {} };
  for (const attr in permissions.is) {
    req.user.permissions.is[attr] = Boolean(permissions.is[attr]);
  }
  for (const attr in permissions.can) {
    req.user.permissions.can[attr] = Boolean(permissions.can[attr]);
  }
  for (const attr in event_permissions.is) {
    req.user.permissions.is[attr] = Boolean(event_permissions.is[attr]);
  }
  for (const attr in event_permissions.can) {
    req.user.permissions.can[attr] = Boolean(event_permissions.can[attr]);
  }
  if (event_permissions.special) {
    Array.prototype.push.apply(req.user.special, event_permissions.special);
  }

  // Filter out links
  if (req.event) {
    const intersects = (array1, array2) => array1.filter(elt => array2.includes(elt)).length > 0;
    req.event.links = req.event.links.filter((link) => {
      return link.visibility.users.includes(req.user.basic.id.toString())
        || intersects(link.visibility.roles, req.user.roles)
        || intersects(link.visibility.special, req.user.special);
    });
  }

  return next();
};
