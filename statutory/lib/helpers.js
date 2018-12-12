const constants = require('./constants');

// A helper to determine if the string is either 'me' or an integer.
exports.isIDValid = id => id === constants.CURRENT_USER_PREFIX || !Number.isNaN(Number(id, 10));

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);

// A helpers to determine if body is a local.
exports.isLocal = (body) => ['antenna', 'contact antenna', 'contact'].includes(body.type);

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

exports.getPermissions = (user, corePermissions) => {
    return {
        create_event: {
            agora: hasPermission(corePermissions, 'manage_event:agora'),
            epm: hasPermission(corePermissions, 'manage_event:epm')
        },
        edit_pax_limits: {
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
    permissions.manage_incoming = hasPermission(corePermissions, 'global:manage_incoming:' + event.type);
    permissions.see_applications = permissions.manage_applications || permissions.manage_incoming;
    permissions.export = permissions.manage_applications || permissions.manage_incoming;

    permissions.set_board_comment_and_participant_type_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);
    permissions.upload_memberslist_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);
    permissions.see_boardview_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);

    permissions.see_memberslists = hasPermission(corePermissions, 'global:see_memberslists:' + event.type);

    permissions.set_board_comment_and_participant_type = {};
    permissions.see_boardview_of = {};
    permissions.upload_memberslist = {};

    permissions.manage_candidates = hasPermission(corePermissions, 'global:manage_candidates:agora');

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    for (const body of user.bodies) {
        permissions.set_board_comment_and_participant_type[body.id] =
          event.can_approve_members && approveBodiesList.includes(body.id);
        permissions.see_boardview_of[body.id] = approveBodiesList.includes(body.id);
        permissions.upload_memberslist[body.id] = approveBodiesList.includes(body.id) && exports.isLocal(body);
    }

    return permissions;
};

exports.getApplicationPermissions = ({ permissions, corePermissions, event, mine }) => {
    // Basically do everything with applications.
    const canManage = hasPermission(corePermissions, 'manage_applications:' + event.type);

    // See pax list and change 'paid_fee' and 'attended' attributes only.
    const isIncoming = hasPermission(corePermissions, 'manage_incoming:' + event.type);

    permissions.see_application = mine || canManage || isIncoming;

    // User can edit application if it's his application and it's within the deadline, or if he has the permission.
    permissions.edit_application = (mine && event.can_apply) || canManage;

    // For cancellation, the same.
    permissions.set_application_cancelled = (mine && event.can_apply) || canManage;

    // For paid fee and cancelled, only if has permissions.
    permissions.set_application_paid_fee = isIncoming || canManage;
    permissions.set_application_attended = isIncoming || canManage;
    permissions.set_application_departed = isIncoming || canManage;

    permissions.change_status = canManage;

    return permissions;
};
