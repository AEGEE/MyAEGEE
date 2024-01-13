// Figure out if the value is a number or a string containing only numbers
exports.isNumber = (value) => {
    /* istanbul ignore next */
    if (typeof value === 'number') {
        return true;
    }

    /* istanbul ignore else */
    if (typeof value === 'string') {
        const valueAsNumber = +value; // converts to number if it's all numbers or to NaN otherwise
        return !Number.isNaN(valueAsNumber);
    }

    /* istanbul ignore next */
    return false;
};

exports.getSorting = (query) => {
    const result = [['id', 'ASC']];

    if (typeof query.sort === 'string') {
        result[0][0] = query.sort;
    }

    if (typeof query.direction === 'string' && ['desc', 'asc'].includes(query.direction)) {
        result[0][1] = query.direction;
    }

    return result;
};

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some((permission) => permission.combined.endsWith(combinedPermission));
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
        view_board: hasPermission(corePermissions, 'view:board')
    };

    permissions.manage_boards = {
        global: hasPermission(corePermissions, 'global:manage_network:boards')
    };

    const manageBoardsList = getBodiesListFromPermissions(managePermissions);
    const userBodies = user && Array.isArray(user.bodies) ? user.bodies : [];
    for (const body of userBodies) {
        permissions.manage_boards[body.id] = manageBoardsList.includes(body.id);
    }

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
