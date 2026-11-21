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

// Claim times are shown in Brussels time, with CET or CEST after them.
const claimTimeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
});

const formatClaimTime = (date) => {
    const parts = Object.fromEntries(claimTimeFormat.formatToParts(new Date(date)).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
};

exports.getMailText = ({ code, integration, user }) => {
    return `Hey ${user.first_name},<br/>
    <br/>
You've claimed the code for the discount, here are the details.<br/>
<br/>
Partner: ${integration.name}<br/>
Code: ${code.value}<br/>
Claimed on: ${formatClaimTime(code.updated_at)}<br/>
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
