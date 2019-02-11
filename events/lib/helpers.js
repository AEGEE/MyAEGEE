const eventTypes = ['wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other'];

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some(permission => permission.combined.endsWith(combinedPermission));
}

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);

// A helper to get bodies list where I have some permission
// from POST /my_permissions
function getBodiesListFromPermissions(result) {
    return result.reduce((acc, val) => acc.concat(val), [])
      .filter(elt => elt.body_id)
      .map(elt => elt.body_id)
      .filter((elt, index, array) => array.indexOf(elt) === index);
}

// A helper to determine if user is an organizer.
exports.isOrganizer = (event, user) => event.organizers.some(organizer => organizer.user_id === user.id);

exports.getPermissions = (user, corePermissions, approvePermissions) => {
    const permissions = {
        approve_event: {},
        manage_event: {}
    };

    for (const type of eventTypes) {
        permissions.approve_event[type] = hasPermission(corePermissions, 'approve_event:' + type);
        permissions.manage_event[type] = hasPermission(corePermissions, 'manage_event:' + type);
    }

    permissions.set_board_comment = {};
    permissions.see_boardview = {};

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    for (const body of user.bodies) {
        permissions.set_board_comment[body.id] = approveBodiesList.includes(body.id);
        permissions.see_boardview[body.id] = approveBodiesList.includes(body.id);
    }

    return permissions;
};

exports.getEventPermissions = ({ permissions, event, user }) => {
    permissions.edit_event = (event.status === 'draft' && exports.isOrganizer(event, user)) || permissions.manage_event[event.type];
    permissions.delete_event = permissions.manage_event[event.type];

    permissions.apply = event.application_status === 'open' && event.status === 'published';

    permissions.approve_participants = exports.isOrganizer(event, user) || permissions.manage_event[event.type];
    permissions.list_applications = exports.isOrganizer(event, user) || permissions.manage_event[event.type];
    permissions.set_status = permissions.approve_event[event.type];

    return permissions;
};

exports.getApplicationPermissions = ({ permissions, user, application }) => {
    const isMine = application.user_id === user.id;

    permissions.view_application = isMine || permissions.list_applications;

    return permissions;
};
