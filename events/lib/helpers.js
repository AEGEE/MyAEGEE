const log = require('./config/logger');

function getBasicPermissions(user) {
  const permissions = {
    is: {},
    can: {},
    special: []
  };

  permissions.is.superadmin = user.user && user.user.superadmin;
  if (permissions.is.superadmin) {
    permissions.special.push('Superadmin');
  }

  permissions.is.board_member_of = {};
  permissions.is.member_of = {};
  for (const body of user.bodies) {
    // Dirty hack, TODO: rethink it.
    permissions.is.board_member_of[body.id] = user.circles.some(circle => circle.name.toLowerCase().includes('board') && circle.body_id === body.id);
    permissions.is.member_of[body.id] = true;
  }

  permissions.can.edit_lifecycles = permissions.is.superadmin;
  permissions.can.delete_lifecycles = permissions.is.superadmin;

  return permissions;
}

function getEventIs(event, user) {
  const is = {};
  is.organizer = event.organizers.some(item => item.user_id === user.id);
  is.own_body = event.organizing_locals.some(organizer => user.bodies.some(body => organizer.body_id === body.id));

  return is;
}

function getEventSpecial(event, user, is) {
  const special = [];
  if (is.own_body) {
    special.push('Organizing Local Member');
  }
  if (is.organizer) {
    special.push('Organizer');
  }

  // Also all eventroles become special roles
  const myorg = event.organizers.find(item => item.user_id === user.id);
  if (myorg && myorg.roles && myorg.roles.length > 0) {
    myorg.roles.forEach((item) => {
      special.push(item.name);
    });
  }

  return special;
}

// Helper function for determining if two arrays are intersecting or not.
const intersects = (array1, array2) => array1.filter(elt => array2.includes(elt)).length > 0;

// Helper function for determining if the user has the right to do something
// TODO: Add circle awareness.

const canUserAccess = (options) => {
  const { user, accessObject, event } = options;

  // Checking users.
  if (accessObject.users && accessObject.users.includes(user.id)) {
    return true;
  }

  // Checking bodies.
  if (accessObject.bodies && intersects(accessObject.bodies, user.bodies.map(body => body.id))) {
    return true;
  }

  // Checking event-related special roles.
  if (event) {
    const permissionIs = getEventIs(event, user);
    const permissionSpecial = getEventSpecial(event, user, permissionIs);
    if (intersects(permissionSpecial, accessObject.special)) {
      return true;
    }
  }

  if (accessObject.special && intersects(accessObject.special, user.special)) {
    return true;
  }

  return false;
};

function getEventPermissions(event, user) {
  const permissions = getBasicPermissions(user);

  if (!event || !user) {
    log.warn('No event or user is provided, returning empty object as a response.');
    return permissions;
  }

  const eventIs = getEventIs(event, user)
  for (const key in eventIs) {
    permissions.is[key] = eventIs[key];
  }

  permissions.special = [...permissions.special, ...getEventSpecial(event, user, permissions.is)];

  permissions.can.edit_organizers = canUserAccess({ user, accessObject: event.status.edit_organizers, event });
  permissions.can.edit_details = canUserAccess({ user, accessObject: event.status.edit_details, event });

  permissions.can.delete = permissions.can.edit_details;

  permissions.can.edit_application_status = canUserAccess({ user, accessObject: event.status.edit_application_status, event });
  permissions.can.edit =
    permissions.can.edit_details
    || permissions.can.edit_organizers
    || permissions.can.delete
    || permissions.can.edit_application_status;

  permissions.can.see = canUserAccess({ user, accessObject: event.status.visibility, event });

  permissions.can.apply =
    permissions.can.see
    && !permissions.is.organizer
    && event.application_status === 'open';

  permissions.can.approve_participants =
    canUserAccess({ user, accessObject: event.status.approve_participants, event }) && event.application_status === 'closed';

  permissions.can.view_applications = canUserAccess({ user, accessObject: event.status.view_applications, event });

  // Allowing members of bodies to put board comments.
  // TODO: rethink that
  permissions.can.put_board_comment_for_application = {};
  for (const app of event.applications) {
    permissions.can.put_board_comment_for_application[app.id] = Object.keys(permissions.is).some(key => permissions.is.board_member_of[key]);
  }

  function setObjToTrue(obj) {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object'){
        setObjToTrue(obj[key]);
      } else {
        obj[key] = true;
      }
    }
  }

  if (permissions.is.superadmin) {
    setObjToTrue(permissions.can);
  }

  return permissions;
}

exports.canUserAccess = canUserAccess;
exports.getEventPermissions = getEventPermissions;
exports.getBasicPermissions = getBasicPermissions;
