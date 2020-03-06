const Moment = require('moment');
const MomentRange = require('moment-range');

const moment = MomentRange.extendMoment(Moment);

const constants = require('./constants');
const { Application, PaxLimit } = require('../models');

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

// A helper to check if the passed value is an object.
exports.isObject = value => typeof value === 'object' && value !== null;

// A helper to check if the value is set.
exports.isDefined = value => typeof value !== 'undefined';

// A helper to check if the value is truthy.
exports.isTruthy = value => exports.isDefined(value) && value !== null;

// A helper to check if the boardview update for application was okay.
// It's run within a transaction, so if this will throw an error, the transaction will be rolled back.
exports.checkApplicationBoardviewValidity = async ({ event, application, body, transaction }) => {
    // If the pax type is null (it wasn't updated or was unset)
    // that means also that pax order is null (look in validations).
    // Therefore, no need to check, the number couldn't increase because of that.
    // Also, to avoid querying on participant_type === null below.
    if (!application.participant_type) {
        return;
    }

    // Fetching pax limits for this body for this event.
    const limit = await PaxLimit.fetchOrUseDefaultForBody(body, event.type);


    // Second, get from database how much people we have for this event
    // from this body with this pax type.
    // If we got the validation error, it'll fail the transaction.
    // Therefore, all the data here is valid.
    const applicationsCount = await Application.count({
        where: {
            event_id: application.event_id,
            body_id: application.body_id,
            participant_type: application.participant_type
        },
        transaction
    });

    if (limit[application.participant_type] !== null) {
        // If the limit's value is not null and is less than
        // the applications amount (meaning, it increased by one within this transaction),
        // that means setting the pax order for this user was a mistake and
        // this needs to be rolled back.
        if (limit[application.participant_type] < applicationsCount) {
            throw new Error(`Too much applications \
for body #${application.body_id} for type "${application.participant_type}": \
expected ${limit[application.participant_type]}, got ${applicationsCount}.`);
        }

        // If the participant_order is bigger than the limit (e.g. envoy (4) when only 3 envoys are eligible)
        // then rolling back as well.
        if (application.participant_order > limit[application.participant_type]) {
            throw new Error(`Expected participant number from 1 to ${applicationsCount}, \
got participant type ${application.participant_order}`);
        }
    }
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

    // First, converting to EUR.
    const feeInEuro = member.fee / conversionRate;

    // Then calculating fee to AEGEE-Europe using the formula above.
    const feeToAEGEE = feeInEuro <= 30
        ? feeInEuro * 0.125 // 12.5% of fee under 30 EUR
        : (30 * 0.125) + (feeInEuro - 30) * 0.05; // 12.5% of 30EUR + 5% fee above 30EUR

    // Minimum EUR amount is 2EUR.
    return Math.max(feeToAEGEE, 2);
};

// Figure out if the value is a number or a string containing only numbers
exports.isNumber = (value) => {
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

// A helpers to determine if body is a local.
exports.isLocal = body => ['antenna', 'contact antenna', 'contact'].includes(body.type);

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
    if (!Array.isArray(permissionsList)) {
        return false;
    }

    return permissionsList.some(permission => permission.combined.endsWith(combinedPermission));
}

// A helper to get bodies list where I have some permission
// from POST /my_permissions
function getBodiesListFromPermissions(result) {
    if (!Array.isArray(result)) {
        return [];
    }

    return result.reduce((acc, val) => acc.concat(val), [])
        .filter(elt => elt.body_id)
        .map(elt => elt.body_id)
        .filter((elt, index, array) => array.indexOf(elt) === index);
}

exports.getPermissions = (user, corePermissions) => {
    return {
        create_event: {
            agora: hasPermission(corePermissions, 'manage_event:agora'),
            epm: hasPermission(corePermissions, 'manage_event:epm'),
            spm: hasPermission(corePermissions, 'manage_event:spm')
        },
        edit_pax_limits: {
            agora: hasPermission(corePermissions, 'manage_event:agora'),
            epm: hasPermission(corePermissions, 'manage_event:epm'),
            spm: hasPermission(corePermissions, 'manage_event:spm')
        },
        see_background_tasks: hasPermission(corePermissions, 'global:see_background_tasks:statutory')
    };
};

exports.getEventPermissions = (data) => {
    const {
        permissions,
        corePermissions,
        approvePermissions,
        user,
        event,
        myApplication
    } = data;


    // Event-related permissions
    permissions.edit_event = hasPermission(corePermissions, 'global:manage_event:' + event.type);
    permissions.change_event_status = hasPermission(corePermissions, 'global:manage_event:' + event.type);
    permissions.delete_event = hasPermission(corePermissions, 'global:manage_event:' + event.type);
    permissions.apply = event.can_apply
        || hasPermission(corePermissions, 'global:manage_applications:' + event.type)
        || hasPermission(corePermissions, 'global:apply:' + event.type);

    permissions.use_massmailer = hasPermission(corePermissions, 'global:use_massmailer:' + event.type);

    permissions.manage_applications = hasPermission(corePermissions, 'global:manage_applications:' + event.type);
    permissions.manage_incoming = hasPermission(corePermissions, 'global:manage_incoming:' + event.type);
    permissions.manage_juridical = hasPermission(corePermissions, 'global:manage_juridical:' + event.type);
    permissions.see_applications = permissions.manage_applications;
    permissions.see_applications_juridical = permissions.manage_applications || permissions.manage_juridical;
    permissions.see_applications_incoming = permissions.manage_applications || permissions.manage_incoming;
    permissions.see_applications_network = permissions.manage_applications || hasPermission(corePermissions, 'global:update_memberslist_status:' + event.type);
    permissions.see_participants_list = event.can_see_participants_list || permissions.manage_applications;
    permissions.export = {
        openslides: permissions.manage_applications || permissions.manage_incoming,
        all: permissions.manage_applications,
        incoming: permissions.manage_applications || permissions.manage_incoming
    };

    permissions.set_board_comment_and_participant_type = {
        global: hasPermission(corePermissions, 'global:approve_members:' + event.type)
    };
    permissions.see_boardview = {
        global: hasPermission(corePermissions, 'global:approve_members:' + event.type)
    };
    permissions.upload_memberslist = {
        global: hasPermission(corePermissions, 'global:approve_members:' + event.type)
    };
    permissions.edit_memberslist = {
        global: hasPermission(corePermissions, 'global:approve_members:' + event.type)
    };
    permissions.see_memberslist = {
        global: hasPermission(corePermissions, 'global:see_memberslists:' + event.type)
    };

    permissions.set_memberslists_fee_paid = hasPermission(corePermissions, 'global:set_memberslists_fee_paid:' + event.type);

    permissions.manage_candidates = hasPermission(corePermissions, 'global:manage_candidates:agora');

    permissions.manage_plenaries = hasPermission(corePermissions, 'global:manage_plenaries:agora');
    permissions.see_plenaries = hasPermission(corePermissions, 'global:see_plenaries:agora') || permissions.manage_plenaries;
    permissions.mark_attendance = hasPermission(corePermissions, 'global:mark_attendance:agora');

    const approveBodiesList = getBodiesListFromPermissions(approvePermissions);
    const bodies = user ? user.bodies : [];

    for (const body of bodies) {
        permissions.set_board_comment_and_participant_type[body.id] = event.can_approve_members && approveBodiesList.includes(body.id);
        permissions.see_boardview[body.id] = approveBodiesList.includes(body.id);
        permissions.upload_memberslist[body.id] = event.can_upload_memberslist && approveBodiesList.includes(body.id) && exports.isLocal(body);
        permissions.edit_memberslist[body.id] = event.can_edit_memberslist && approveBodiesList.includes(body.id) && exports.isLocal(body);
        permissions.see_memberslist[body.id] = approveBodiesList.includes(body.id) && exports.isLocal(body);
    }

    permissions.manage_question_lines = hasPermission(corePermissions, 'global:manage_question_lines:' + event.type);
    permissions.see_questions = permissions.manage_question_lines || (myApplication ? myApplication.confirmed : false);
    permissions.submit_questions = myApplication ? myApplication.confirmed : false;

    return permissions;
};

exports.getApplicationPermissions = ({ permissions, corePermissions, event, mine, application }) => {
    // Apply disregard the application period
    const canApply = hasPermission(corePermissions, 'apply:' + event.type);

    // Basically do everything with applications.
    const canManage = hasPermission(corePermissions, 'manage_applications:' + event.type);

    // See pax list and change 'confirmed' and 'attended' attribute only.
    const isIncoming = hasPermission(corePermissions, 'manage_incoming:' + event.type);

    // See JC list and change 'registered' and 'departed' attributes only.
    const isJuridical = hasPermission(corePermissions, 'manage_juridical:' + event.type);

    // Update is_on_memberslist attribute (Network Director).
    const updateMemberslistStatus = hasPermission(corePermissions, 'update_memberslist_status:' + event.type);

    permissions.see_application = mine || canManage || isIncoming || permissions.see_boardview[application.body_id];

    // User can edit application if it's his application and it's within the deadline, or if he has the permission.
    permissions.edit_application = (mine && event.can_apply) || canManage || canApply;

    // For cancellation, the same.
    permissions.set_application_cancelled = (mine && event.can_apply) || canManage;

    // For paid fee and cancelled and others, only if has permissions.
    permissions.set_application_confirmed = isIncoming || canManage;
    permissions.set_application_attended = isIncoming || canManage;
    permissions.set_application_registered = isJuridical || canManage;
    permissions.set_application_departed = isJuridical || canManage;
    permissions.set_application_is_on_memberslist = updateMemberslistStatus || canManage;

    permissions.change_status = canManage;

    return permissions;
};

exports.getPositionPermissions = ({ permissions, position }) => {
    permissions.submit_candidature = position.status === 'open' || permissions.manage_candidates;

    return permissions;
};

exports.getCandidatePermissions = ({ permissions, candidate, user }) => {
    const mine = candidate.user_id === user.id;

    permissions.edit_candidature = (mine && candidate.status === 'pending') || permissions.manage_candidates;
    permissions.set_candidature_status = permissions.manage_candidates;

    return permissions;
};
