const eventTypes = ['wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other'];

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
  return permissionsList.some(permission => permission.combined.endsWith(combinedPermission));
}

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);


// A helper to determine if user is an organizer.
function isOrganizer(event, user) {
  return event.organizers.some(organizer => organizer.user_id === user.id);
}

function getPermissions(user, corePermissions) {
  const permissions = {
    approve_event: eventTypes.map(type => hasPermission(corePermissions, 'approve_event:' + type)),
    manage_event: eventTypes.map(type => hasPermission(corePermissions, 'manage_event:' + type))
  };

  return permissions;
}

function getEventPermissions({ permissions, event, user, approvePermissions }) {
  permissions.edit_event = isOrganizer(event, user) || permissions.manage_event[event.type];
  permissions.delete_event = permissions.manage_event[event.type];

  permissions.apply = event.application_status === 'open';

  permissions.approve_participants = isOrganizer(event, user);
  permissions.view_applications = isOrganizer(event, user) || permissions.manage_event[event.type];

  const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
  for (const body of user.bodies) {
    permissions.set_board_comment[body.id] = approveBodiesList.includes(body.id);
    permissions.see_boardview_of[body.id] = approveBodiesList.includes(body.id);
  }

  return permissions;
}

exports.getPermissions = getPermissions;
exports.getEventPermissions = getEventPermissions;
