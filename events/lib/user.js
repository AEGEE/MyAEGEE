const EventRole = require('./models/EventRole.js');
const eventRolesConfig = require('./config/eventroles');
const mongoose = require('mongoose');
const log = require('./config/logger.js');
const restify = require('restify');
const httprequest = require('request-promise-native');

const communication = require('./communication');

const config = require('./config/config.js');

const getUserById = async (authToken, id) => {
  const core = await communication.getServiceByName('omscore-nginx');

  const opts = {
    url: `${core.backend_url}/api/users/${id}`,
    method: 'GET',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Auth-Token': authToken
    },
    qs: {
      id,
    },
    json: true
  };

  const body = await httprequest(opts);

  if (!body.success) {
    throw new Error(`Error while getting user from core: ${body}`);
  }

  return body.data;
};

exports.getUserById = getUserById;


// Everything related to users

const identityTransform = (user) => { return user; };


// This function expects an array of objects with the field "foreign_id"
// and fetches userdata for each object in this array and stores it in the "data" field.
// Also you can pass a transform function that transforms the data somehow.
// The authtoken should be the authtoken of the requesting user.
exports.populateUsers = async (usersArray, authToken, transform = identityTransform) => {
  const personsToFetch = [];

  // Find what there is to fetch
  usersArray.forEach((item) => {
    // Only add those where we need to fetch something
    if (item.foreign_id && !(item.cached && item.cached.length && item.cached.length > 0)) {
      personsToFetch.push(item.foreign_id);
    }
  });

  const fetchUser = async (personId) => {
    try {
      const personData = await getUserById(authToken, personId);
      return transform(personData);
    } catch (err) {
      log.error('A request to the core fetching user data failed', err);
      return {};
    }
  };

  const fetchedResults = await Promise.all(personsToFetch.map(fetchUser));

  return fetchedResults;
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

exports.getDefaultEventRoles = async () => {
  try {
    const roles = await EventRole.findOne({ cfg_id: eventRolesConfig.default_role });
    return [roles];
  } catch (err) {
    log.error('Could not fetch default user role');
    return [];
  }
};
