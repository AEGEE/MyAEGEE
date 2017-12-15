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
exports.updateEventRoles = async () => {
  const unupdatedRoles = eventRolesConfig.roles;

  let addedRoles = 0;
  let updatedRoles = 0;
  let deletedRoles = 0;

  // Find all roles there are and update them
  const roles = await EventRole.find({});

  for (const role of roles) {
    const idx = unupdatedRoles.findIndex(i => i.cfg_id === role.cfg_id);
    if (idx === undefined || idx === -1) {
      // This element should not be in the db anymore
      try {
        await role.remove();
        deletedRoles++;
      } catch (err) {
        log.error('Could not remove userrole', err);
      }
    } else {
      // Update the element, even if it needs no updating
      role.name = unupdatedRoles[idx].name;
      role.description = unupdatedRoles[idx].description;
      unupdatedRoles.splice(idx, 1);
      try {
        await role.save();
        updatedRoles++;
      } catch (err) {
        log.error('Could not update userrole', err);
      }
    }
  }

  // Add the non-existant ones.
  for (const item of unupdatedRoles) {
    const role = new EventRole(item);
    try {
      addedRoles++;
      await role.save();
    } catch (err) {
      log.error('Could not save new event role', err);
    }
  }

  log.info(`Event roles: added: ${addedRoles}, updated: ${updatedRoles}, deleted: ${deletedRoles}.`);
};


exports.getEventRoles = async (req, res, next) => {
  const roles = await EventRole.find({});
  res.json({
    success: true,
    data: roles
  });

  return next();
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
