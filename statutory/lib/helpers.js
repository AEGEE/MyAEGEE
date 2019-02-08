const moment = require('moment');

const constants = require('./constants');

// A helper to whilelist object's properties.
exports.whitelistObject = (object, allowedFields) => {
    const newObject = {};
    for (const field of allowedFields) {
        newObject[field] = object[field];
    }

    return newObject;
};

// A helper to filter object by another object fields.
exports.filterObject = (object, targetObject) => {
    for (const field in targetObject) {
        if (object[field] !== targetObject[field]) {
            return false;
        }
    }

    return true;
};

// A helper to count objects in array by field.
exports.countByField = (array, key) => {
    return array.reduce((acc, val) => {
        const existing = acc.find(obj => obj.type === val[key]);
        if (existing) {
            existing.value += 1;
        } else {
            acc.push({ type: val[key], value: 1 });
        }
        return acc;
    }, [])
}

// A helper to flatten the nested object. Copypasted from Google.
exports.flattenObject = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && Object.prototype.toString.call(obj[k]) !== '[object Date]') {
            Object.assign(acc, exports.flattenObject(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }

        return acc;
    }, {});
};

// A helper uset to pretty-format values.
exports.beautify = (value) => {
    // If it's boolean, display it as Yes/No instead of true/false
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    // If it's date, return date formatted.
    if (Object.prototype.toString.call(value) === '[object Date]') {
        return moment(value).format('YYYY-MM-DD HH:mm:SS');
    }

    // Else, present it as it is.
    return value;
};

// A helper to determine if the string is either 'me' or an integer.
exports.isIDValid = id => id === constants.CURRENT_USER_PREFIX || !Number.isNaN(Number(id, 10));

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);

// A helpers to determine if body is a local.
exports.isLocal = body => ['antenna', 'contact antenna', 'contact'].includes(body.type);

// A helper to get the names for application fields. Useful for exporting for getting columns headers.
exports.getApplicationFields = (event) => {
    const fields = Object.assign({}, constants.APPLICATION_FIELD_NAMES);
    for (let index = 0; index < event.questions.length; index++) {
        fields['answers.' + index] = `Answer ${index + 1}: ${event.questions[index].description}`;
    }

    return fields;
};

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
    permissions.manage_juridical = hasPermission(corePermissions, 'global:manage_juridical:' + event.type);
    permissions.see_applications = permissions.manage_applications;
    permissions.see_applications_juridical = permissions.manage_applications || permissions.manage_juridical;
    permissions.see_applications_incoming = permissions.manage_applications || permissions.manage_incoming;
    permissions.see_participants_list = event.can_see_participants_list || permissions.manage_applications;
    permissions.export = {
        openslides: permissions.manage_applications || permissions.manage_incoming,
        all: permissions.manage_applications,
        incoming: permissions.manage_applications || permissions.manage_incoming
    };

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
        permissions.set_board_comment_and_participant_type[body.id] = event.can_approve_members && approveBodiesList.includes(body.id);
        permissions.see_boardview_of[body.id] = approveBodiesList.includes(body.id);
        permissions.upload_memberslist[body.id] = approveBodiesList.includes(body.id) && exports.isLocal(body);
    }

    return permissions;
};

exports.getApplicationPermissions = ({ permissions, corePermissions, event, mine }) => {
    // Basically do everything with applications.
    const canManage = hasPermission(corePermissions, 'manage_applications:' + event.type);

    // See pax list and change 'paid_fee' and 'attended' attribute only.
    const isIncoming = hasPermission(corePermissions, 'manage_incoming:' + event.type);

    // See JC list and change 'registered' and 'departed' attributes only.
    const isJuridical = hasPermission(corePermissions, 'manage_juridical:' + event.type);

    permissions.see_application = mine || canManage || isIncoming;

    // User can edit application if it's his application and it's within the deadline, or if he has the permission.
    permissions.edit_application = (mine && event.can_apply) || canManage;

    // For cancellation, the same.
    permissions.set_application_cancelled = (mine && event.can_apply) || canManage;

    // For paid fee and cancelled, only if has permissions.
    permissions.set_application_paid_fee = isIncoming || canManage;
    permissions.set_application_attended = isIncoming || canManage;
    permissions.set_application_registered = isJuridical || canManage;
    permissions.set_application_departed = isJuridical || canManage;

    permissions.change_status = canManage;

    return permissions;
};

exports.getPositionPermissions = ({ permissions, position }) => {
    permissions.submit_candidature = position.can_apply || permissions.manage_candidates;

    return permissions;
};

exports.getCandidatePermissions = ({ permissions, position, candidate, user }) => {
    const mine = candidate.user_id === user.id;

    permissions.edit_candidature = (mine && position.status === 'open') || permissions.manage_candidates;
    permissions.set_candidature_status = permissions.manage_candidates;

    return permissions;
};
