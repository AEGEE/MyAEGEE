const constants = require('./constants');

// A helper to determine if the string is either 'me' or an integer.
exports.isIDValid = id => id === constants.CURRENT_USER_PREFIX || !Number.isNaN(Number(id, 10));

// A helper to say if the answer match questions.
exports.isAnswersValid = (questions, answers) => Array.isArray(answers) && answers.length === questions.length;

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, body_id) => user.bodies.map(body => body.id).includes(body_id);

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
            epm:  hasPermission(corePermissions, 'manage_event:epm')
        }
    };
};

exports.getEventPermissions = ({ permissions, corePermissions, approvePermissions, user, event }) => {
    // Event-related permissions
    permissions.edit_event = hasPermission(corePermissions, 'manage_event:' + event.type);
    permissions.change_event_status = hasPermission(corePermissions, 'manage_event:' + event.type);
    permissions.delete_event = hasPermission(corePermissions, 'manage_event:' + event.type);
    permissions.apply = event.can_apply || hasPermission(corePermissions, 'manage_applications:' + event.type);

    permissions.see_applications = hasPermission(corePermissions, 'see_applications:' + event.type);
    permissions.set_board_comment_and_participant_type_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);
    permissions.see_boardview_global = hasPermission(corePermissions, 'global:approve_members:' + event.type);

    permissions.set_board_comment_and_participant_type = {};
    permissions.see_boardview_of = {};

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    for (const body of user.bodies) {
        permissions.set_board_comment_and_participant_type[body.id] = approveBodiesList.includes(body.id)
        permissions.see_boardview_of[body.id] = approveBodiesList.includes(body.id)
    }

    return permissions;
}

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
}