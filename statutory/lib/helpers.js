const constants = require('./constants');

// A helper to determine if the string is either 'me' or an integer.
exports.isIDValid = id => id === constants.CURRENT_USER_PREFIX || !Number.isNaN(Number(id, 10));

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some(permission => permission.combined.endsWith(combinedPermission));
}

// A helper to get bodies list where I have some permission
// from POST /my_permissions
function getBodiesListFromPermissions(result) {
    return result.reduce((acc, val) => acc.concat(val), [])
        .filter(elt => elt.body_id)
        .map(elt => elt.body_id)
        .filter((elt, index, array) => array.indexOf(elt) === index);
}

// TODO: Refactor with permissions in oms-core-elixir
exports.getPermissions = (user, corePermissions) => {
    return {
        create_event: {
            agora: hasPermission(corePermissions, 'manage_event:agora'),
            epm: hasPermission(corePermissions, 'manage_event:epm')
        }
    };
};

exports.getEventPermissions = ({ permissions, corePermissions, approvePermissions, user, event }) => {
    // Event-related permissions
    permissions.edit_event = hasPermission(corePermissions, 'global:manage_event:' + event.type);
    permissions.change_event_status = hasPermission(corePermissions, 'global:manage_event:' + event.type);
    permissions.delete_event = hasPermission(corePermissions, 'global:manage_event:' + event.type);
    permissions.apply = event.can_apply || hasPermission(corePermissions, 'global:manage_applications:' + event.type);

    permissions.use_massmailer = hasPermission(corePermissions, 'global:use_massmailer:' + event.type);

    permissions.manage_applications = hasPermission(corePermissions, 'global:manage_applications:' + event.type);
    permissions.set_board_comment_and_participant_type_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);
    permissions.upload_memberslist_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);
    permissions.see_boardview_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);

    permissions.see_memberslists = hasPermission(corePermissions, 'global:see_memberslists:' + event.type);

    permissions.set_board_comment_and_participant_type = {};
    permissions.see_boardview_of = {};
    permissions.upload_memberslist = {};

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    for (const body of user.bodies) {
        permissions.set_board_comment_and_participant_type[body.id] =
          event.can_approve_members && approveBodiesList.includes(body.id);
        permissions.see_boardview_of[body.id] = approveBodiesList.includes(body.id);
        permissions.upload_memberslist[body.id] = approveBodiesList.includes(body.id);
    }

    return permissions;
};

exports.getApplicationPermissions = ({ permissions, corePermissions, event, mine }) => {
    // If user can manage application (has rights in the system).
    const canManage = hasPermission(corePermissions, 'manage_applications:' + event.type);

    // If user can change applications' status (has rights in the system).
    const canAccept = hasPermission(corePermissions, 'accept_applications:' + event.type);

    // User can edit application if it's his application and it's within the deadline, or if he has the permission.
    permissions.edit_application = (mine && event.can_apply) || canManage;

    // For cancellation, the same.
    permissions.set_application_cancelled = (mine && event.can_apply) || canManage;

    // For paid fee and cancelled, only if has permissions.
    permissions.set_application_paid_fee = canManage;
    permissions.set_application_attended = canManage;

    permissions.change_status = canAccept;

    return permissions;
};
