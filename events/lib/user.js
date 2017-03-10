const EventRole = require('./models/EventRole.js');
const eventRolesConfig = require('./config/eventroles');
const mongoose = require('mongoose');
const log = require('./config/logger.js');
const restify = require('restify');
const httprequest = require('request');

const config = require('./config/config.js');

const getUserById = (authToken, id, callback) => {
  require('./config/options.js').then((options) => {
    const opts = {
      url: `${config.core.url}:${config.core.port}/api/getUser`,
      method: 'GET',
      headers: options.getRequestHeaders(authToken),
      qs: {
        id,
      },
    };

    httprequest(opts, (requestError, requestResult, requestBody) => {
      if (requestError) {
        // log.error("Could not contact core", err);
        return callback(requestError, null);
      }

      let body;
      try {
        body = JSON.parse(requestBody);
      } catch (err) {
        // log.error("Could not parse core response", err);
        return callback(err, null);
      }

      if (!body.success) {
        // log.info("Access denied to user", body);
        return callback(null, null);
      }
      body.user.antenna_name = body.user.antenna.name;
      return callback(null, { basic: body.user });
    });
  });
};

exports.getUserById = getUserById;


// Everything related to users

const identityTransform = (user) => { return user; };


// This function expects an array of objects with the field "foreign_id"
// and fetches userdata for each object in this array and stores it in the "data" field.
// To improve performance, you can add a field "cached" to each object,
// which you populate with the UserCache directly.
// If you did that, this function will copy all data
// from "cached" to "data" and fetch the missing ones.
// Also you can pass a transform function that transforms the data somehow.
// The authtoken should be the authtoken of the requesting user.
exports.populateUsers = (somearray, authtoken, callback, transform = identityTransform) => {
  var personsToFetch = [];

  // Find what there is to fetch
  somearray.forEach((item) => {
    // Only add those where we need to fetch something
    if (item.foreign_id && !(item.cached && item.cached.length && item.cached.length > 0)) {
      personsToFetch.push(item.foreign_id);
    }
  });

  var mapcallback = (fetchedResults) => {
    var results = somearray.map((item) => {
      if (item.cached && item.cached.length && item.cached.length > 0) {
        item.data = transform(item.cached[0]);
        delete item.cached;
        return item;
      } else {
        if (!fetchedResults[item.foreign_id]) {
          log.warn('User with id ' + foreign_id + ' could not be retrieved');
        } else {
          item.data = transform(fetchedResults[item.foreign_id]);
        }

        return item;
      }
    });
    return callback(results);
  };


  // Fetch
  // TODO add batch fetch
  var fetchedResults = {};
  var count = personsToFetch.length;
  if (count === 0) {
    return mapcallback(fetchedResults);
  }
  personsToFetch.forEach((foreign_id) => {
    getUserById(authtoken, foreign_id, (err, res) => {
      if (err) {
        log.error('A request to the core fetching user data failed', err);
        fetchedResults[foreign_id] = {};
      } else {
        fetchedResults[foreign_id] = res;
      }

      count--;
      if (count === 0) {
        return mapcallback(fetchedResults);
      }
    });
  });
};

// Updates the eventRoles in the database to what there is in the .json file
exports.updateEventRoles = () => {
  const unupdatedRoles = eventRolesConfig.roles;

  // Update existing roles
  const addMissing = () => {
    unupdatedRoles.forEach((item) => {
      const role = new EventRole(item);
      role.save((err) => {
        if (err) {
          log.error('Could not save new event role', err);
        }
      });
    });
  };

  // Find all roles there are and update them
  EventRole.find({}).exec((err, res) => {
    let barrier = res.length;
    // No items existing yet
    if (barrier === 0) {
      addMissing();
      return;
    }

    // Update or delete each element
    res.forEach((item) => {
      const idx = unupdatedRoles.findIndex(i => i.cfg_id === item.cfg_id);
      if (idx === undefined || idx === -1) {
        // This element should not be in the db anymore
        item.remove((removeErr) => {
          if (removeErr) {
            log.error('Could not remove userrole', removeErr);
          }
        });
      } else {
        // Update the element, even if it needs no updating
        item.name = unupdatedRoles[idx].name;
        item.description = unupdatedRoles[idx].description;
        unupdatedRoles.splice(idx, 1);
        item.save((saveErr) => {
          if (saveErr) {
            log.error('Could not update userrole', saveErr);
          }
        });
      }

      // If all items were updated, add the missing ones
      barrier--;
      if (barrier === 0) {
        addMissing();
        log.info(`Updated ${res.length} eventroles and added ${unupdatedRoles.length} new ones`);
      }
    });
  });
};


exports.getEventRoles = (req, res, next) => {
  EventRole.find({}).exec((err, roles) => {
    if (err) {
      log.error(err);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        },
      }));
    }

    res.json({
      success: true,
      data: roles,
    });

    return next();
  });
};

exports.getDefaultEventRoles = (callback) => {
  EventRole.findOne({ cfg_id: eventRolesConfig.default_role }).exec((err, res) => {
    if (err) {
      log.error('Could not fetch default user role');
      return callback([]);
    }
    callback([res]);
  });
};
