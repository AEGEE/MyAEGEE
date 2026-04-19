const moment = require('moment');

// Figure out if the value is an integer or a string containing only digits.
exports.isNumber = (value) => {
    if (typeof value === 'number') {
        return Number.isInteger(value);
    }

    if (typeof value === 'string') {
        return /^\d+$/.test(value);
    }

    return false;
};

exports.getMailText = ({ code, integration, user }) => {
    return `Hey ${user.first_name},<br/>
    <br/>
You've claimed the code for the discount, here are the details.<br/>
<br/>
Partner: ${integration.name}<br/>
Code: ${code.value}<br/>
Claimed on: ${moment.utc(code.updated_at).format('YYYY-MM-DD HH:mm')}<br/>
<br/>
${integration.description}<br/>
<br/>
Sincerely yours,<br/>
MyAEGEE discounts team.`;
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

exports.getPermissions = (user, corePermissions) => {
    return {
        manage_discounts: hasPermission(corePermissions, 'manage:discounts')
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
