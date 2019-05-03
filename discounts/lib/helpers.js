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

exports.getMailText = ({ code, integration, user}) => {
    return `Hey ${user.first_name},

You've claimed the code for the discount, here are the details.

Partner: ${integration.name}
Code: ${code.value}
Claimed on: ${moment(code.created_at).format('YYYY-MM-DD HH:MM')}

${integration.description}

Sincerely yours,
MyAEGEE discounts team.`
};

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some(permission => permission.combined.endsWith(combinedPermission));
}

exports.getPermissions = (user, corePermissions) => {
    return {
        manage_discounts: hasPermission(corePermissions, 'manage:discounts')
    };
};
