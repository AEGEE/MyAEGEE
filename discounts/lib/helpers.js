const moment = require('moment');

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

exports.getMailText = ({ code, integration, user }) => {
    return `Hey ${user.first_name},<br/>
    <br/>
You've claimed the code for the discount, here are the details.<br/>
<br/>
Partner: ${integration.name}<br/>
Code: ${code.value}<br/>
Claimed on: ${moment(code.updated_at).format('YYYY-MM-DD HH:MM')}<br/>
<br/>
${integration.description}<br/>
<br/>
Sincerely yours,<br/>
MyAEGEE discounts team.`;
};

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some((permission) => permission.combined.endsWith(combinedPermission));
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
