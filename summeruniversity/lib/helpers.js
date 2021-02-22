const moment = require('moment');

const constants = require('./constants');
const { Sequelize } = require('./sequelize');

// A helper to get default search/query/pagination filter for events listings.
exports.getDefaultQuery = (req) => {
    // Default filter is empty.
    const queryObj = {
        where: {},
        order: [['starts', 'ASC']],
        select: constants.EVENT_PUBLIC_FIELDS
    };

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

    // Filtering by event start and end dates.
    // The events are not inclusive, so when the event starts on 2018-01-02 and ends on 2018-01-17, querying
    // from 2018-01-05 to 2018-01-10 won't return it.
    const dateQuery = [];
    if (req.query.starts) dateQuery.push({ starts: { [Sequelize.Op.gte]: moment(req.query.starts, 'YYYY-MM-DD').startOf('day').toDate() } });
    if (req.query.ends) dateQuery.push({ ends: { [Sequelize.Op.lte]: moment(req.query.ends, 'YYYY-MM-DD').endOf('day').toDate() } });
    queryObj.where[Sequelize.Op.and] = dateQuery;

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

// Figure out if the value is a number or a string containing only numbers
exports.isNumber = (value) => {
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

// A helper to whilelist object's properties.
exports.whitelistObject = (object, allowedFields) => {
    const newObject = {};
    for (const field of allowedFields) {
        newObject[field] = object[field];
    }

    return newObject;
};

// A helper to determine if user has permission.
function hasPermission(permissionsList, combinedPermission) {
    if (!Array.isArray(permissionsList)) {
        return false;
    }

    return permissionsList.some((permission) => permission.combined.endsWith(combinedPermission));
}

// A helpers to determine if the user is member of a body.
exports.isMemberOf = (user, bodyId) => user.bodies.map((body) => body.id).includes(bodyId);

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

// A helper to determine if user is an organizer.
exports.isOrganizer = (event, user) => {
    if (!user) {
        return false;
    }

    return event.organizers.some((organizer) => organizer.user_id === user.id);
};

exports.getPermissions = (user, corePermissions, approvePermissions) => {
    const permissions = {
        approve_summeruniversity: {},
        manage_summeruniversity: {}
    };

    for (const type of constants.EVENT_TYPES) {
        permissions.approve_summeruniversity[type] = hasPermission(corePermissions, 'approve_summeruniversity:' + type);
        permissions.manage_summeruniversity[type] = hasPermission(corePermissions, 'manage_summeruniversity:' + type);
    }

    permissions.set_board_comment = {};
    permissions.see_boardview = {};

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    const userBodies = user && Array.isArray(user.bodies) ? user.bodies : [];
    for (const body of userBodies) {
        permissions.set_board_comment[body.id] = approveBodiesList.includes(body.id);
        permissions.see_boardview[body.id] = approveBodiesList.includes(body.id);
    }

    return permissions;
};

exports.getEventPermissions = ({ permissions, event, user }) => {
    const canApprove = permissions.approve_summeruniversity[event.type];
    const canApproveOrIsOrganizer = exports.isOrganizer(event, user) || canApprove;

    // The event can only be seen to public if it's published and not deleted.
    // Otherwise (if it's deleted, submitted or draft) it should be accessible
    // only to LOs and those who can approve it.
    permissions.see_summeruniversity = (event.status === 'published' && !event.deleted)
        || canApproveOrIsOrganizer;

    permissions.edit_summeruniversity = (event.status !== 'second approval' && exports.isOrganizer(event, user)) || permissions.manage_summeruniversity[event.type];
    permissions.delete_summeruniversity = permissions.manage_summeruniversity[event.type];

    permissions.apply = event.application_status === 'open' && event.status === 'published';

    permissions.approve_participants = exports.isOrganizer(event, user) || permissions.manage_summeruniversity[event.type];
    permissions.set_participants_attended = exports.isOrganizer(event, user) || permissions.manage_summeruniversity[event.type];
    permissions.set_participants_confirmed = exports.isOrganizer(event, user) || permissions.manage_summeruniversity[event.type];
    permissions.export = exports.isOrganizer(event, user) || permissions.manage_summeruniversity[event.type];

    // Status transitions.
    // 1) first draft -> first submission - by event creator / LOs (when saved)
    // 2) first submission -> first draft - by those who can approve (reject approval)
    // 3) first submission -> first approval - by those who can approve (approve)
    // 4) first approval -> first submission - by those who can approve (unpublish)
    // 5) first approval -> second submission - by event creator / LOs (when saving second submission)
    // 6) second draft -> second submission - by event creator / LOs (when saving second submission)
    // 7) second submission -> second draft - by those who can approve (reject approval)
    // 8) second submission -> second approval - by those who can approve (approve)
    // 9) second approval -> second submission - by those who can approve (unpublish)
    permissions.change_status = {
        first_draft: event.status === 'first submission' && canApprove, // 2
        first_approval: event.status === 'first submission' && canApprove, // 3
        first_submission: (event.status === 'first approval' && canApprove) // 4
            || (event.status === 'first draft' && canApproveOrIsOrganizer), // 1
        second_draft: event.status === 'second submission' && canApprove, // 7
        second_approval: event.status === 'second submission' && canApprove, // 8
        second_submission: (event.status === 'second approval' && canApprove) // 9
            || (event.status === 'second draft' && canApproveOrIsOrganizer) // 6
            || (event.status === 'first approval' && canApproveOrIsOrganizer) // 5
    };

    return permissions;
};
