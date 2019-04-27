const moment = require('moment');

// A helper to calculate time for plenary.
exports.calculateTimeForPlenary = (attendance, plenary) => {
    if (!attendance.ends) {
        return 0;
    }

    // We need the intersection of the attendance range and the plenary range
    // because some people can come earlier to the plenary and some
    // people can leave later for some reason.
    const attendanceRange = moment.range(attendance.starts, attendance.ends);
    const plenaryRange = moment.range(plenary.starts, plenary.ends);
    const intersectRange = plenaryRange.intersect(attendanceRange);

    if (!intersectRange) {
        return 0;
    }

    const difference = intersectRange.diff('seconds', true);
    return difference;
};

// A helper to calculate fee for member of memberslist with given conversion rate to EUR.
exports.calculateFeeForMember = (member, conversionRate) => {
    // According to Matis (FD):
    // As per the CIA, the formula for calculating the fees is "1An annual membership fee
    // towards AEGEE-Europe of 25% of the part of the local annual membership fee under 30 euro
    // has to be paid for each current member, with a minimum of 4 euro
    // per current member plus 10% of the part of the local annual membership fee above 30 Euro"
    //
    // Dividing these numbers by 2 as there's 2 Agorae and locals pay fee for their
    // members at each of them.

    // If the fee is 0, the member doesn't pay anything to AEGEE-Europe.
    if (member.fee === 0) {
        return 0;
    }

    // First, converting to EUR.
    const feeInEuro = member.fee / conversionRate;

    // Then calculating fee to AEGEE-Europe using the formula above.
    const feeToAEGEE = feeInEuro <= 30
        ? feeInEuro * 0.125 // 12.5% of fee under 30 EUR
        : (30 * 0.125) + feeInEuro * 0.05; // 12.5% of 30EUR + 5% fee above 30EUR

    // Minimum EUR amount is 2EUR.
    return Math.max(feeToAEGEE, 2);
};

// Figure out if the value is a number or a string containing only numbers
exports.isNumber = (value) => {
    if (typeof value === 'number') {
        return true;
    }

    if (typeof value === 'string') {
        const valueAsNumber = +value; // converts to number if it's all numbers or to NaN otherwise
        return !Number.isNaN(valueAsNumber);
    }

    return false;
};

// A helper to whilelist object's properties.
exports.whitelistObject = (object, allowedFields) => {
    const newObject = {};
    for (const field of allowedFields) {
        newObject[field] = object[field];
    }

    return newObject;
};

// A helper to blacklist object's properties.
exports.blacklistObject = (object, filteredFields) => {
    const newObject = Object.assign({}, object);
    for (const field of filteredFields) {
        delete newObject[field];
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
    }, []);
};

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
        return moment(value).format('YYYY-MM-DD HH:mm:ss');
    }

    // Else, present it as it is.
    return value;
};

// A helper to check if the given application matches one of the members in memberslist.
exports.memberMatchApplication = (member, application) => {
    // First, checking if user_id match.
    if (member.user_id === application.user_id) {
        return true;
    }

    // If this fails, check if the first_name and last_name match.
    return member.first_name.toLowerCase() === application.first_name.toLowerCase()
        && member.last_name.toLowerCase() === application.last_name.toLowerCase();
};

// A helper to check if the memberslist has this member on it.
// Used on memberslist update and on applying/changing the application.
exports.memberslistHasMember = (memberslist, application) => {
    // If no memberslist, then return false immediately.
    if (!memberslist) {
        return false;
    }

    // Otherwise, iterate through members to check if some of them match.
    return memberslist.members.some(member => exports.memberMatchApplication(member, application));
};


// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    return permissionsList.some(permission => permission.combined.endsWith(combinedPermission));
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
