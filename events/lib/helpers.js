const moment = require('moment');

const constants = require('./constants');
const { Sequelize } = require('./sequelize');

// A helper to get default search/query/pagination filter for events listings.
exports.getDefaultQuery = (req) => {
    // Default filter is empty.
    const queryObj = {
        where: {},
        order: [['starts', 'DESC']]
    }

    // If search is set, searching for event by name or description case-insensitive.
    if (req.query.search) {
        queryObj.where[Sequelize.Op.or] = [
            { name: { [Sequelize.Op.iLike]: '%' + req.query.search + '%' } },
            { description: { [Sequelize.Op.iLike]: '%' + req.query.search + '%' } }
        ];
    }

    // If event type is set, filter on it.
    if (req.query.type) {
        queryObj.where.type = Array.isArray(req.query.type) ? { [Sequelize.Op.in]: req.query.type } : req.query.type;
    }

    // If displayPast === false, only displaying future events.
    if (req.query.displayPast === false) {
        queryObj.where.starts = { [Sequelize.Op.gte]: new Date() };
    }

    // If offset is set and is valid, use it.
    if (req.query.offset) {
        const offset = parseInt(req.query.offset, 10);
        if (!Number.isNaN(offset) && offset >= 0) {
            queryObj.offset = offset;
        }
    }

    // If limit is set and is valid, use it.
    if (req.query.limit) {
        const limit = parseInt(req.query.limit, 10);
        if (!Number.isNaN(limit) && limit > 0) {
            queryObj.limit = limit;
        }
    }

    return queryObj;
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
        return moment(value).format('YYYY-MM-DD HH:mm:SS');
    }

    // Else, present it as it is.
    return value;
};

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

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map(body => body.id).includes(bodyId);

// A helper to get bodies list where I have some permission
// from POST /my_permissions
function getBodiesListFromPermissions(result) {
    return result.reduce((acc, val) => acc.concat(val), [])
      .filter(elt => elt.body_id)
      .map(elt => elt.body_id)
      .filter((elt, index, array) => array.indexOf(elt) === index);
}

// A helper to determine if user is an organizer.
exports.isOrganizer = (event, user) => event.organizers.some(organizer => organizer.user_id === user.id);

exports.getPermissions = (user, corePermissions, approvePermissions) => {
    const permissions = {
        approve_event: {},
        manage_event: {}
    };

    for (const type of constants.EVENT_TYPES) {
        permissions.approve_event[type] = hasPermission(corePermissions, 'approve_event:' + type);
        permissions.manage_event[type] = hasPermission(corePermissions, 'manage_event:' + type);
    }

    permissions.set_board_comment = {};
    permissions.see_boardview = {};

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    for (const body of user.bodies) {
        permissions.set_board_comment[body.id] = approveBodiesList.includes(body.id);
        permissions.see_boardview[body.id] = approveBodiesList.includes(body.id);
    }

    return permissions;
};

exports.getEventPermissions = ({ permissions, event, user }) => {
    permissions.edit_event = (event.status === 'draft' && exports.isOrganizer(event, user)) || permissions.manage_event[event.type];
    permissions.delete_event = permissions.manage_event[event.type];

    permissions.apply = event.application_status === 'open' && event.status === 'published';

    permissions.approve_participants = exports.isOrganizer(event, user) || permissions.manage_event[event.type];
    permissions.list_applications = exports.isOrganizer(event, user) || permissions.manage_event[event.type];
    permissions.export = exports.isOrganizer(event, user) || permissions.manage_event[event.type];
    permissions.set_status = permissions.approve_event[event.type];

    return permissions;
};

exports.getApplicationPermissions = ({ permissions, user, application }) => {
    const isMine = application.user_id === user.id;

    permissions.view_application = isMine || permissions.list_applications;

    return permissions;
};
