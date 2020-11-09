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

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some((permission) => permission.combined.endsWith(combinedPermission));
}

exports.getPermissions = (user, corePermissions) => {
    return {
        manage_boards: hasPermission(corePermissions, 'manage_network:boards')
    };
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
