const httprequest = require('request');
const config = require('./config/config.js');

function getEventPermissions(event, user) {
  const permissions = {
    is: {},
    can: {},
    special: [],
  };

  if (!event || !user) {
    return permissions;
  }

  permissions.is.organizer = event.organizers.some(item => item.foreign_id === user.id);

  permissions.is.own_antenna = event.organizing_locals.some(organizer =>
    user.bodies.some(body => organizer.foreign_id === body.id));

  permissions.can.edit_organizers = permissions.is.organizer;

  permissions.can.edit_details =
    (permissions.is.organizer &&
     event.application_status === 'closed') // && event.status === 'draft')  TODO add lifecycle awareness
    || permissions.is.superadmin;

  permissions.can.delete = permissions.can.edit_details;

  permissions.can.edit_application_status =
    (permissions.is.organizer) // && event.status === 'approved') TODO not valid with lifecycle anymore
    || permissions.is.superadmin;

  // TODO: probably remove this one, since we have the lifecycle workflow
  permissions.can.approve =
    event.application_status === 'closed' || permissions.is.superadmin;

  permissions.can.edit =
    permissions.can.edit_details
    || permissions.can.edit_organizers
    || permissions.can.delete
    || permissions.can.edit_application_status
    || permissions.can.approve;

  /* permissions.can.apply =
    (!permissions.is.organizer && event.application_status === 'open')
    || permissions.is.superadmin; */

  permissions.can.approve_participants = permissions.is.organizer &&
    event.application_status === 'closed';

  permissions.can.view_applications =
    permissions.is.organizer
    || (permissions.is.boardmember && permissions.is.own_antenna)
    || permissions.is.superadmin;

  // Special roles

  // TODO that doesn't work that way, boardmember is generic for all boardmembers
  if (permissions.is.boardmember && permissions.is.own_antenna) {
    permissions.special.push('Organizing Board Member');
  }
  if (permissions.is.own_antenna) {
    permissions.special.push('Organizing Local Member');
  }
  if (permissions.is.organizer) {
    permissions.special.push('Organizer');
  }

  // Also all eventroles become special roles
  const myorg = event.organizers.find(item => item.foreign_id === user.id);
  if (myorg && myorg.roles && myorg.roles.length > 0) {
    myorg.roles.forEach((item) => {
      permissions.special.push(item.name);
    });
  }

  return permissions;
}

exports.getEventPermissions = getEventPermissions;

// Helper function for determining if two arrays are intersecting or not.
const intersects = (array1, array2) => array1.filter(elt => array2.includes(elt)).length > 0;

// Helper function for determining if the user has the right to do something
// TODO: Add circle awareness.
module.exports.canUserAccess = (user, accessObject, event = null) => {
  // Checking users.
  if (accessObject.users && accessObject.users.includes(user.id)) {
    return true;
  }

  // Checking roles.
  if (accessObject.roles && intersects(accessObject.roles, user.roles)) {
    return true;
  }

  // Checking event-related special roles.
  if (event) {
    const permissions = getEventPermissions(event, user);
    if (intersects(permissions.special, accessObject.special)) {
      return true;
    }
  }

  if (accessObject.special && intersects(accessObject.special, user.special)) {
    return true;
  }

  return false;
};
