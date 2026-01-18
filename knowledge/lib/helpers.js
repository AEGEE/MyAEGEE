// Figure out if the value is a number or a string containing only numbers
function isNumber(value) {
    /* istanbul ignore if */
    if (typeof value === 'number') {
        return true;
    }

    /* istanbul ignore else */
    if (typeof value === 'string') {
        const valueAsNumber = +value; // converts to number if it's all numbers or to NaN otherwise
        return !Number.isNaN(valueAsNumber);
    }

    // Is not covered, probably will be in the future.
    /* istanbul ignore next */
    return false;
}

function getPagination(query) {
    const result = {};

    if (query.limit && isNumber(query.limit) && query.limit > 0) {
        result.limit = +query.limit;
    }

    if (query.offset && isNumber(query.offset) && query.offset > 0) {
        result.offset = +query.offset;
    }

    return result;
}

function getSorting(query) {
    const result = [['id', 'ASC']];

    if (typeof query.sort === 'string') {
        result[0][0] = query.sort;
    }

    if (typeof query.direction === 'string' && ['desc', 'asc'].includes(query.direction)) {
        result[0][1] = query.direction;
    }

    return result;
}

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some((permission) => permission.combined.endsWith(combinedPermission));
}

function getPermissions(user, corePermissions) {
    return {
        view_knowledge: hasPermission(corePermissions, 'view:knowledge'),
        manage_knowledge: hasPermission(corePermissions, 'manage:knowledge')
    };
}

// A helper to add data to gauge Prometheus metric.
const addGaugeData = (gauge, array) => {
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

module.exports = {
    isNumber,
    getPagination,
    getSorting,
    getPermissions,
    addGaugeData
};
