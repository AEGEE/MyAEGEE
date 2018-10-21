const httprequest = require('request-promise-native');

const EventRole = require('./models/EventRole');
const eventRolesConfig = require('./config/eventroles');
const log = require('./config/logger');

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
  return res.json({
    success: true,
    data: roles
  });
};

exports.getDefaultEventRoles = async () => {
  try {
    const roles = await EventRole.findOne({ cfg_id: eventRolesConfig.default_role });
    return [roles];
  } catch (err) {
    log.error('Could not fetch default user role: %s', err);
    return [];
  }
};
