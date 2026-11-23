// The largest Postgres INTEGER, which is the type of the IDs.
const MAX_ID = 2147483647;

// Figure out if the value is an integer or a string containing only digits, within the ID range
exports.isNumber = (value) => {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0 && value <= MAX_ID;
    }

    if (typeof value === 'string') {
        return /^\d+$/.test(value) && Number(value) <= MAX_ID;
    }

    return false;
};

const SORT_FIELDS = ['id', 'body_id', 'elected_date', 'start_date', 'end_date'];

exports.getSorting = (query) => {
    const result = [['id', 'ASC']];

    if (typeof query.sort === 'string' && SORT_FIELDS.includes(query.sort)) {
        result[0][0] = query.sort;
    }

    if (typeof query.direction === 'string' && ['desc', 'asc'].includes(query.direction)) {
        result[0][1] = query.direction;
    }

    return result;
};

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    if (!Array.isArray(permissionsList)) {
        return false;
    }

    return permissionsList.some((permission) => permission
        && typeof permission.combined === 'string'
        && permission.combined.endsWith(combinedPermission));
}

// Viewing boards is granted by the global permission only.
function hasGlobalPermission(permissionsList, combinedPermission) {
    if (!Array.isArray(permissionsList)) {
        return false;
    }

    return permissionsList.some((permission) => permission && permission.combined === combinedPermission);
}

// A helper to get bodies list where I have some permission
// from POST /my_permissions
function getBodiesListFromPermissions(result) {
    if (!Array.isArray(result)) {
        return [];
    }

    return result
        .filter((elt) => elt.body_id)
        .map((elt) => elt.body_id)
        .filter((elt, index, array) => array.indexOf(elt) === index);
}

exports.getPermissions = (user, corePermissions, managePermissions) => {
    const permissions = {
        view_board: hasGlobalPermission(corePermissions, 'global:view:board'),
        manage_antenna_criteria: hasPermission(corePermissions, 'global:manage_network:antenna_criteria'),
        manage_netcom_assignment: hasPermission(corePermissions, 'global:manage_network:netcom_assignment'),
        send_mails: hasPermission(corePermissions, 'global:manage_network:fulfilment_email'),
    };

    permissions.manage_boards = {
        global: hasPermission(corePermissions, 'global:manage_network:boards')
    };

    const manageBoardsList = getBodiesListFromPermissions(managePermissions);
    const userBodies = user && Array.isArray(user.bodies) ? user.bodies : [];
    for (const body of userBodies) {
        permissions.manage_boards[body.id] = manageBoardsList.includes(body.id);
    }

    permissions.antenna_criteria = {
        communication: hasPermission(corePermissions, 'global:manage_network:communication'),
        communication_exception: hasPermission(corePermissions, 'global:manage_network:communication_exception'),
        board_election: hasPermission(corePermissions, 'global:manage_network:board_election'),
        members_list: hasPermission(corePermissions, 'global:manage_network:members_list'),
        membership_fee: hasPermission(corePermissions, 'global:manage_network:membership_fee'),
        events: hasPermission(corePermissions, 'global:manage_network:events'),
        agora_attendance: hasPermission(corePermissions, 'global:manage_network:agora_attendance'),
        development_plan: hasPermission(corePermissions, 'global:manage_network:development_plan'),
        fulfilment_report: hasPermission(corePermissions, 'global:manage_network:fulfilment_report'),
    };

    return permissions;
};

// A helper to add data to gauge Prometheus metric.
exports.addGaugeData = (gauge, array) => {
    // reset gauge...
    gauge.reset();

    // and set it with values
    for (const element of array) {
        const {
            value,
            ...data
        } = element;

        gauge.set(data, value);
    }
};
