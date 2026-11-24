const crypto = require('crypto');
const moment = require('moment');
const xlsx = require('node-xlsx').default;

const errors = require('./errors');
const core = require('./core');
const mailer = require('./mailer');
const { Application, VotesPerAntenna, PaxLimit, Event } = require('../models');
const constants = require('./constants');
const helpers = require('./helpers');
const getQuorumStats = require('./quorum');
const { Sequelize } = require('./sequelize');
const logger = require('./logger');
const locks = require('./locks');

async function getEditableBodiesForUser(req, user) {
    const limits = await Promise.all(
        user.bodies.map((body) => PaxLimit.fetchOrUseDefaultForBody(body, req.event.type))
    );

    return user.bodies.filter((body) => {
        const limit = limits.find((item) => item.body_id === body.id);
        return limit && limit.hasAnyLimits();
    });
}

function hasManageApplicationsPermission(corePermissions) {
    return Array.isArray(corePermissions)
        && corePermissions.some((permission) => permission.combined.match(/^global:manage_applications:(agora|epm|spm)$/));
}

function canListFutureApplicationsForBan(corePermissions) {
    return Array.isArray(corePermissions)
        && corePermissions.some((permission) => permission.combined === 'global:update_application_ban:member');
}

// The board comment is for those who select the participants: the board of the applicant's
// body, those who approve members of all bodies and those who manage applications.
function canSeeBoardComment(req, application) {
    return Boolean(
        req.permissions.manage_applications
        || req.permissions.see_boardview.global
        || req.permissions.see_boardview[application.body_id]
    );
}

// The application as the caller may see it: the applicant does not get the board comment,
// and reads the status "pending" until the event reveals the statuses.
function presentApplication(req, application) {
    const presented = application.toJSON();
    if (!canSeeBoardComment(req, application)) {
        delete presented.board_comment;
    }

    // Only where the caller gets the status: the local organisers' fields have none.
    if ('status' in presented && helpers.shouldHideApplicationStatus(req.event, req.permissions)) {
        presented.status = 'pending';
    }

    return presented;
}

// What the officers who can set one flag of an application see of it in their own listing.
const INCOMING_OFFICER_FIELDS = [...constants.ALLOWED_INCOMING_FIELDS, 'notification_email'];
const FLAG_OFFICER_FIELDS = {
    confirmed: INCOMING_OFFICER_FIELDS,
    incoming: INCOMING_OFFICER_FIELDS,
    attended: INCOMING_OFFICER_FIELDS,
    registered: constants.ALLOWED_JURIDICAL_LIST_FIELDS,
    departed: constants.ALLOWED_JURIDICAL_LIST_FIELDS,
    is_on_memberslist: constants.ALLOWED_NETWORK_LIST_FIELDS
};

// The application as the caller may see it after setting one of its flags: the whole
// application for the applicant and for those who manage applications, and the fields
// of their own listing for the incoming, juridical and network officers.
function presentApplicationAfterFlag(req, application, key) {
    const presented = presentApplication(req, application);
    const officerFields = FLAG_OFFICER_FIELDS[key];

    if (!officerFields || req.permissions.manage_applications || application.user_id === req.user.id) {
        return presented;
    }

    return helpers.whitelistObject(presented, officerFields);
}

// Checks the sorting and paging parameters of a list of applications.
// A list can be sorted by the fields it returns: all of them, unless a list of fields is given.
// Returns the error message, or null if the parameters are fine.
function getListQueryError(query, fields = Object.keys(Application.rawAttributes)) {
    for (const key of ['limit', 'offset']) {
        const value = query[key];
        if (helpers.isDefined(value) && (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) {
            return `The "${key}" parameter should be a whole number, zero or higher.`;
        }
    }

    if (!helpers.isObject(query.sort)) {
        return null;
    }

    // The supported fields are listed in the description of the API.
    if (helpers.isDefined(query.sort.field) && (typeof query.sort.field !== 'string' || !fields.includes(query.sort.field))) {
        return 'Sorting by this field is not supported.';
    }

    if (helpers.isDefined(query.sort.order) && (typeof query.sort.order !== 'string' || !['asc', 'desc'].includes(query.sort.order.toLowerCase()))) {
        return 'The sorting order should be "asc" or "desc".';
    }

    return null;
}

function isApplicationBanActive(user) {
    return user.event_application_ban && new Date(user.event_application_ban.ban_until) > new Date();
}

exports.listFutureApplicationsForUser = async (req, res) => {
    if (!canListFutureApplicationsForBan(req.corePermissions) && !hasManageApplicationsPermission(req.corePermissions)) {
        return errors.makeForbiddenError(res, 'You are not allowed to see future applications.');
    }

    if (!helpers.isNumber(req.params.user_id)) {
        return errors.makeBadRequestError(res, 'User ID should be a number.');
    }

    const applications = await Application.findAll({
        where: {
            user_id: Number(req.params.user_id),
            cancelled: false,
            status: { [Sequelize.Op.in]: ['pending', 'waiting_list', 'accepted'] }
        },
        include: [{
            model: Event,
            required: true,
            where: {
                starts: { [Sequelize.Op.gt]: new Date() },
                status: 'published'
            }
        }],
        order: [[Event, 'starts', 'ASC']]
    });

    return res.json({
        success: true,
        data: applications.map((application) => ({
            service: 'statutory',
            application_id: application.id,
            application_status: application.status,
            event_id: application.event.id,
            event_name: application.event.name,
            event_type: application.event.type,
            event_starts: application.event.starts
        }))
    });
};

exports.listAllApplications = async (req, res) => {
    if (!req.permissions.see_applications) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const queryError = getListQueryError(req.query);
    if (queryError) {
        return errors.makeBadRequestError(res, queryError);
    }

    const applications = await Application.findWithParams({
        where: { event_id: req.event.id },
        query: req.query
    });

    if (applications.rows.length > 0) {
        const userIds = applications.rows.map((application) => application.user_id).toString();
        const mails = await core.getMails(req, userIds);

        for (const application of applications.rows) {
            const user = mails.find((m) => application.user_id === m.id);

            if (!user) {
                logger.warn({ user_id: application.user_id }, 'Could not find user');
                continue;
            }

            application.dataValues.notification_email = user.notification_email;
        }
    }

    return res.json({
        success: true,
        data: applications.rows,
        meta: {
            count: applications.count
        }
    });
};

exports.listIncomingApplications = async (req, res) => {
    if (!req.permissions.see_applications_incoming) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const queryError = getListQueryError(req.query, constants.ALLOWED_INCOMING_FIELDS);
    if (queryError) {
        return errors.makeBadRequestError(res, queryError);
    }

    const applications = await Application.findWithParams({
        where: { event_id: req.event.id, cancelled: false, status: 'accepted' },
        attributes: constants.ALLOWED_INCOMING_FIELDS,
        query: req.query
    });

    if (applications.rows.length > 0) {
        const userIds = applications.rows.map((application) => application.user_id).toString();
        const mails = await core.getMails(req, userIds);

        for (const application of applications.rows) {
            const user = mails.find((m) => application.user_id === m.id);

            if (!user) {
                logger.warn({ user_id: application.user_id }, 'Could not find user');
                continue;
            }

            application.dataValues.notification_email = user.notification_email;
        }
    }

    return res.json({
        success: true,
        data: applications.rows,
        meta: {
            count: applications.count
        }
    });
};

exports.listAcceptedApplications = async (req, res) => {
    if (!req.permissions.see_participants_list) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const applications = await Application.findAll({
        where: { event_id: req.event.id, cancelled: false, status: 'accepted' },
        attributes: constants.ALLOWED_PARTICIPANTS_LIST_FIELDS,
        order: [
            ['body_name', 'ASC'],
            ['participant_type', 'ASC NULLS LAST'],
            ['participant_order', 'ASC NULLS LAST']
        ]
    });

    return res.json({
        success: true,
        data: applications
    });
};

exports.listJCApplications = async (req, res) => {
    if (!req.permissions.see_applications_juridical) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const queryError = getListQueryError(req.query, constants.ALLOWED_JURIDICAL_LIST_FIELDS);
    if (queryError) {
        return errors.makeBadRequestError(res, queryError);
    }

    const applications = await Application.findWithParams({
        where: { event_id: req.event.id, cancelled: false, status: 'accepted', confirmed: true },
        attributes: constants.ALLOWED_JURIDICAL_LIST_FIELDS,
        query: req.query
    });

    return res.json({
        success: true,
        data: applications.rows,
        meta: {
            count: applications.count
        }
    });
};

exports.listNetworkApplications = async (req, res) => {
    if (!req.permissions.see_applications_network) {
        return errors.makeForbiddenError(res, 'You are not allowed to see applications.');
    }

    const queryError = getListQueryError(req.query, constants.ALLOWED_NETWORK_LIST_FIELDS);
    if (queryError) {
        return errors.makeBadRequestError(res, queryError);
    }

    const applications = await Application.findWithParams({
        where: { event_id: req.event.id, cancelled: false },
        attributes: constants.ALLOWED_NETWORK_LIST_FIELDS,
        query: req.query
    });

    return res.json({
        success: true,
        data: applications.rows,
        meta: {
            count: applications.count
        }
    });
};

exports.getStats = async (req, res) => {
    const statsObject = {
        by_date: [],
        by_date_cumulative: [],
        by_body: [],
        by_type: []
    };

    const applications = await Application.findAll({
        where: { event_id: req.event.id }
    });

    // Those who manage applications see the statuses, as on a single application.
    if (helpers.shouldHideApplicationStatus(req.event, { change_status: req.permissions.manage_applications })) {
        statsObject.numbers = {
            total: applications.length,
            accepted: 0,
            rejected: 0,
            pending: applications.length - applications.filter((app) => helpers.filterObject(app, { cancelled: true })).length,
            waiting_list: 0,
            cancelled: applications.filter((app) => helpers.filterObject(app, { cancelled: true })).length,
            confirmed: 0,
            registered: 0,
            attended: 0,
            departed: 0
        };
    } else {
        statsObject.numbers = {
            total: applications.length,
            accepted: applications.filter((app) => helpers.filterObject(app, { cancelled: false, status: 'accepted' })).length,
            rejected: applications.filter((app) => helpers.filterObject(app, { cancelled: false, status: 'rejected' })).length,
            pending: applications.filter((app) => helpers.filterObject(app, { cancelled: false, status: 'pending' })).length,
            waiting_list: applications.filter((app) => helpers.filterObject(app, { cancelled: false, status: 'waiting_list' })).length,
            cancelled: applications.filter((app) => helpers.filterObject(app, { cancelled: true })).length,
            confirmed: applications.filter((app) => helpers.filterObject(app, { confirmed: true })).length,
            registered: applications.filter((app) => helpers.filterObject(app, { registered: true })).length,
            attended: applications.filter((app) => helpers.filterObject(app, { attended: true })).length,
            departed: applications.filter((app) => helpers.filterObject(app, { departed: true })).length
        };
    }

    // Filtering out cancelled applications.
    const notCancelledApplications = applications.filter((app) => !app.cancelled);
    statsObject.quorum = getQuorumStats(applications, req.event);

    // By date
    const dates = notCancelledApplications.map((app) => moment(app.created_at).format('YYYY-MM-DD'))
        .filter((elt, index, array) => array.indexOf(elt) === index)
        .sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    let cumulativeSum = 0;

    // Iterating through dates from the first one to the last one incrementing by day.
    for (let date = moment(startDate, 'YYYY-MM-DD'); date.isSameOrBefore(moment(endDate, 'YYYY-MM-DD')); date = date.add(1, 'day')) {
        const dateFormatted = moment(date).format('YYYY-MM-DD');
        const applicationsAmount = notCancelledApplications
            .filter((elt) => moment(elt.created_at).format('YYYY-MM-DD') === dateFormatted)
            .length;

        cumulativeSum += applicationsAmount;
        statsObject.by_date.push({ date: dateFormatted, value: applicationsAmount });
        statsObject.by_date_cumulative.push({ date: dateFormatted, value: cumulativeSum });
    }

    statsObject.by_gender = helpers
        .countByField(notCancelledApplications, 'gender')
        .sort((a, b) => b.value - a.value); // sort descending by gender
    statsObject.by_meal = helpers
        .countByField(notCancelledApplications, 'meals')
        .sort((a, b) => b.value - a.value); // sort descending by dietary type
    statsObject.by_type = helpers
        .countByField(notCancelledApplications, 'participant_type')
        .sort((a, b) => b.value - a.value); // sort descending by participant type
    statsObject.by_body = helpers
        .countByField(notCancelledApplications, 'body_id')
        .sort((a, b) => b.value - a.value); // sort descending by pax amount
    statsObject.by_number_of_events_visited = helpers
        .countByField(notCancelledApplications, 'number_of_events_visited')
        .sort((a, b) => a.type - b.type); // sort ascending by number of Agora/EPM visited

    return res.json({
        success: true,
        data: statsObject
    });
};

exports.listBoardView = async (req, res) => {
    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID should be a number.');
    }

    if (!req.permissions.see_boardview.global && !req.permissions.see_boardview[req.params.body_id]) {
        return errors.makeForbiddenError(res, 'You are not allowed to see the boardview of this body.');
    }

    // 'zzzzz' is used to be last, 'unset' won't do
    const applications = await Application.findAll({
        where: { event_id: req.event.id, body_id: Number(req.params.body_id) },
    });

    if (applications.length > 0) {
        const userIds = applications.map((application) => application.user_id).toString();
        const mails = await core.getMails(req, userIds);

        for (const application of applications) {
            const user = mails.find((m) => application.user_id === m.id);

            if (!user) {
                logger.warn({ user_id: application.user_id }, 'Could not find user');
                continue;
            }

            application.dataValues.notification_email = user.notification_email;
        }
    }

    const sortedApplications = applications.sort((a, b) => {
        // first, comparing by participant type
        const compareByType = (a.participant_type || 'zzzzzz').localeCompare(b.participant_type || 'zzzzzz');
        if (compareByType !== 0) {
            return compareByType;
        }

        // then if participant type is the same, comparing by order
        const compareByOrder = (a.participant_order || 999) - (b.participant_order || 999);
        if (compareByOrder !== 0) {
            return compareByOrder;
        }

        // this can happen when both participant type and order are null.
        return a.id - b.id;
    });

    return res.json({
        success: true,
        data: sortedApplications
    });
};

exports.getApplication = async (req, res) => {
    if (!req.permissions.see_application && !req.permissions.see_application_incoming) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this application.');
    }

    const application = presentApplication(req, req.application);
    application.editable_bodies = [];

    if (req.permissions.edit_application) {
        const user = req.user.id === req.application.user_id
            ? req.user
            : await core.getMember(req, req.application.user_id);

        application.editable_bodies = await getEditableBodiesForUser(req, user);
    }

    application.permissions = req.permissions;

    return res.json({
        success: true,
        data: application
    });
};

exports.updateApplication = async (req, res) => {
    if (!req.permissions.edit_application) {
        return errors.makeForbiddenError(res, 'You cannot edit this application.');
    }

    const user = await core.getMember(req, req.application.user_id);
    const requestedBody = req.body.body_id ? user.bodies.find((body) => req.body.body_id === body.id) : null;
    if (req.body.body_id && !helpers.isMemberOf(user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    if (requestedBody && req.body.body_id !== req.application.body_id) {
        const limit = await PaxLimit.fetchOrUseDefaultForBody(requestedBody, req.event.type);
        if (!limit.hasAnyLimits()) {
            return errors.makeForbiddenError(res, 'You cannot apply as this body cannot send any participants.');
        }
    }

    // Only the fields of the application form are saved, anything else in the request is ignored.
    const fields = helpers.whitelistObject(req.body, constants.APPLICATION_FORM_FIELDS);

    // Some fields are filled in from the user/body automatically.
    fields.first_name = user.first_name;
    fields.last_name = user.last_name;
    fields.gender = user.gender;
    fields.date_of_birth = user.date_of_birth;
    if (fields.body_id) {
        // Shouldn't crash, if the person is not a member of a body,
        // it will be caught by helpers.isMemberOf() above.
        fields.body_name = requestedBody.name;
    }

    // If the body was changed, reset the board comment and participant type/order.
    if (fields.body_id && fields.body_id !== req.application.body_id) {
        fields.participant_type = null;
        fields.participant_order = null;
        fields.board_comment = null;
    }

    // Keeping old body, as apparently next line is changing req.application as well.
    const oldBody = req.application.body_id;

    // The edit and the votes per delegate of the old and the new body change together.
    // returning: the answer has the values as they were stored, not as they were sent.
    await locks.transaction(async (t) => {
        await req.application.update(fields, { transaction: t, returning: true });

        // The votes of the two bodies are locked in the order of their ids, as by every request,
        // so that two edits that move in opposite directions wait for each other instead of
        // locking each other.
        if (fields.body_id && fields.body_id !== oldBody) {
            for (const bodyId of [oldBody, fields.body_id].sort((a, b) => a - b)) {
                await VotesPerAntenna.recalculateVotesForDelegates(req.event, bodyId, t);
            }
        }
    });

    // The edit is saved: the mails about it are sent afterwards, and a failure does not undo it.
    const ids = { application_id: req.application.id, event_id: req.event.id };
    // Both at once: a mailer that does not answer delays the answer by one timeout, not two.
    await Promise.all([
        mailer.sendMailAfterSave({ template: 'statutory_edited.html', ids }, () => mailer.sendMail({
            to: user.notification_email,
            subject: `Your application for ${req.event.name} was updated`,
            template: 'statutory_edited.html',
            parameters: {
                application: req.application,
                event: req.event
            }
        })),
        mailer.sendMailAfterSave({ template: 'statutory_board_edited.html', ids }, async () => {
            const boardMembers = await core.getBodyUsersForPermission({
                action: 'approve_members',
                object: req.event.type
            }, req.application.body_id);

            if (boardMembers.length > 0) {
                await mailer.sendMail({
                    to: boardMembers.map((member) => member.user.notification_email),
                    subject: `One of your body members changed the application to ${req.event.name}`,
                    template: 'statutory_board_edited.html',
                    parameters: {
                        application: req.application,
                        event: req.event
                    }
                });
            }
        })
    ]);

    return res.json({
        success: true,
        data: presentApplication(req, req.application)
    });
};

function setApplicationBoolean(key) {
    return async (req, res) => {
        // Only 'cancelled' can work with '/me' postfix.
        if (key !== 'cancelled' && req.params.application_id === constants.CURRENT_USER_PREFIX) {
            return errors.makeForbiddenError(res, `You cannot change the "${key}" attribute through this endpoint.`);
        }

        // Either the current user or this user who has permission to see it is allowed.
        if (!req.permissions['set_application_' + key]) {
            return errors.makeForbiddenError(
                res,
                `You don't have permissions to change the "${key}" attribute of this application.`
            );
        }

        const toUpdate = {};
        toUpdate[key] = req.body[key];

        // The flag and the votes per delegate for this antenna change together, or not at all.
        const dbResult = await locks.transaction(async (t) => {
            const updated = await req.application.update(
                toUpdate,
                { returning: ['*'], hooks: false, transaction: t }
            );

            await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.application.body_id, t);
            return updated;
        });

        return res.json({
            success: true,
            data: presentApplicationAfterFlag(req, dbResult, key)
        });
    };
}

exports.setApplicationCancelled = setApplicationBoolean('cancelled');
exports.setApplicationAttended = setApplicationBoolean('attended');
exports.setApplicationConfirmed = setApplicationBoolean('confirmed');
exports.setApplicationIncoming = setApplicationBoolean('incoming');
exports.setApplicationRegistered = setApplicationBoolean('registered');
exports.setApplicationDeparted = setApplicationBoolean('departed');
exports.setApplicationIsOnMemberslist = setApplicationBoolean('is_on_memberslist');

exports.setApplicationStatus = async (req, res) => {
    if (req.params.application_id === constants.CURRENT_USER_PREFIX) {
        return errors.makeForbiddenError(res, 'You cannot edit status of yourself.');
    }

    // Either the current user or this user who has permission to see it is allowed.
    if (!req.permissions.change_status) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the "status" attribute of this application.'
        );
    }

    // The status and the votes per delegate for this antenna change together, or not at all.
    const dbResult = await locks.transaction(async (t) => {
        const updated = await req.application.update(
            { status: req.body.status },
            { returning: ['*'], transaction: t }
        );

        await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.application.body_id, t);
        return updated;
    });

    return res.json({
        success: true,
        data: dbResult
    });
};

// For single application
exports.setApplicationBoard = async (req, res) => {
    if (req.params.application_id === constants.CURRENT_USER_PREFIX) {
        return errors.makeForbiddenError(res, 'You cannot edit board comment or participant type of yourself.');
    }

    // Either the current user or this user who has permission to see it is allowed.
    if (
        !req.permissions.set_board_comment_and_participant_type[req.application.body_id]
        && !req.permissions.set_board_comment_and_participant_type.global
    ) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the board comment or participant type of this application.'
        );
    }

    // need to fetch body to get its body type
    const body = await core.getBody(req, req.application.body_id);
    if (!body) {
        return errors.makeNotFoundError(res, 'Body is not found.');
    }

    const toUpdate = {};
    if (helpers.isDefined(req.body.participant_type)) toUpdate.participant_type = req.body.participant_type;
    if (helpers.isDefined(req.body.participant_order)) toUpdate.participant_order = req.body.participant_order;
    if (helpers.isDefined(req.body.board_comment)) toUpdate.board_comment = req.body.board_comment;

    // Well, this is tricky.
    // Simplest way possible: executing it, then checking how many people
    // from this body with this pax type we have and matching it
    // against the limit for this body. If something goes wrong or there's a
    // calculation error, rollback everything. Advantages: don't need to worry
    // about validations, they'll fail the transaction.
    let application;
    try {
        application = await locks.transaction(async (t) => {
            // First, saving the application.
            // If we've passed after this one, there's no duplicated, validations
            // and constraint take care about it.
            const updated = await req.application.update(toUpdate, { returning: ['*'], transaction: t });

            // Recalculating votes per delegate for this antenna.
            await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.application.body_id, t);

            // Checking is done in a helper.
            await helpers.checkApplicationBoardviewValidity({
                body,
                event: req.event,
                application: updated,
                transaction: t
            });

            return updated;
        });
    } catch (err) {
        // The transaction was rolled back. What the participants limits of the body do not
        // allow is refused; any other error (validation, a lock, the database) is answered as such.
        if (err instanceof helpers.BoardChangeRefused) {
            return errors.makeForbiddenError(res, err.message);
        }

        throw err;
    }

    // The change is committed.
    return res.json({
        success: true,
        data: application
    });
};

// WARNING: This will reset all of the pax types and orders and board comments
// and will set it only for those specified in the input.
exports.setBoardForBody = async (req, res) => {
    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'The body ID is invalid.');
    }

    if (
        !req.permissions.set_board_comment_and_participant_type[req.params.body_id]
        && !req.permissions.set_board_comment_and_participant_type.global
    ) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the board comment or participant type of this body.'
        );
    }

    // Validating input.
    if (!Array.isArray(req.body)) {
        return errors.makeBadRequestError(res, 'The body is not an array.');
    }

    for (const [index, entry] of req.body.entries()) {
        if (!helpers.isObject(entry)) {
            return errors.makeBadRequestError(res, `Entry ${index + 1}: is not an object.`);
        }

        if (typeof entry.user_id !== 'number') {
            return errors.makeBadRequestError(res, `Entry ${index + 1}: user ID is not a number.`);
        }

        if (typeof entry.participant_type !== 'string') {
            return errors.makeBadRequestError(res, `Entry ${index + 1}: participant type is not a string.`);
        }

        if (typeof entry.participant_order !== 'number') {
            return errors.makeBadRequestError(res, `Entry ${index + 1}: participant order is not a number.`);
        }
    }

    // need to fetch body to get its body type
    const body = await core.getBody(req, req.params.body_id);
    if (!body) {
        return errors.makeNotFoundError(res, 'Body is not found.');
    }

    // Same as in above.
    try {
        await locks.transaction(async (t) => {
            // First, resetting all applications' pax type, order and board comment.
            // (will re-set them later).
            await Application.update(
                {
                    participant_type: null,
                    participant_order: null,
                    board_comment: null
                },
                {
                    where: {
                        event_id: req.event.id,
                        body_id: body.id
                    },
                    transaction: t,
                    hooks: false // apparently event_id is not there yet somehow, and anyway it's not needed
                }
            );

            // Then iterating through entries.
            for (const [index, entry] of req.body.entries()) {
                // Finding the application required.
                const application = await Application.findOne({
                    where: {
                        user_id: entry.user_id,
                        event_id: req.event.id,
                        body_id: body.id
                    },
                    transaction: t
                });

                if (!application) {
                    throw new helpers.BoardChangeRefused(`Entry ${index + 1}: this user has no application from this body.`);
                }

                const toUpdate = {
                    participant_type: entry.participant_type,
                    participant_order: entry.participant_order
                };
                if (helpers.isTruthy(entry.board_comment)) toUpdate.board_comment = entry.board_comment;

                // First, saving the application.
                // If we've passed after this one, there's no duplications, validations
                // and constraint take care about it.
                await application.update(toUpdate, { returning: ['*'], transaction: t });

                // Checking is done in a helper.
                await helpers.checkApplicationBoardviewValidity({
                    body,
                    event: req.event,
                    application,
                    transaction: t
                });
            }

            // Recalculating votes per delegate for this antenna.
            // We only do it once, because a lot of applications are changed.
            await VotesPerAntenna.recalculateVotesForDelegates(req.event, req.params.body_id, t);
        });
    } catch (err) {
        // The transaction was rolled back. What the participants limits of the body do not
        // allow is refused; any other error (validation, a lock, the database) is answered as such.
        if (err instanceof helpers.BoardChangeRefused) {
            return errors.makeForbiddenError(res, err.message);
        }

        throw err;
    }

    // If we got here, everything is okay.
    return res.json({
        success: true,
        message: 'Board information was updated.'
    });
};

exports.postApplication = async (req, res) => {
    if (req.event.status !== 'published') {
        return errors.makeForbiddenError(res, 'You cannot apply to this event, as it is not published yet.');
    }

    if (!req.permissions.apply) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed or the applications period hasn\'t started yet.');
    }

    if (isApplicationBanActive(req.user)) {
        return errors.makeForbiddenError(res, 'You are temporarily banned from applying to events.');
    }

    if (!helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    // need to fetch body to get its body type
    const body = await core.getBody(req, req.body.body_id);
    if (!body) {
        return errors.makeNotFoundError(res, 'Body is not found.');
    }

    // Do not allow applying if the limit for a body is not set.
    const limit = await PaxLimit.fetchOrUseDefaultForBody(body, req.event.type);
    if (!limit.hasAnyLimits()) {
        return errors.makeForbiddenError(res, 'You cannot apply as this body cannot send any participants.');
    }

    // Only the fields of the application form are saved, anything else in the request is ignored.
    const fields = helpers.whitelistObject(req.body, constants.APPLICATION_FORM_FIELDS);

    fields.user_id = req.user.id;
    fields.event_id = req.event.id;

    // Some fields are filled in from the user/body automatically.
    fields.first_name = req.user.first_name;
    fields.last_name = req.user.last_name;
    fields.gender = req.user.gender;
    fields.body_name = req.user.bodies.find((b) => fields.body_id === b.id).name;
    fields.date_of_birth = req.user.date_of_birth;

    // In a transaction for the lock of the statutory ID (see the model).
    const newApplication = await locks.transaction((t) => Application.create(fields, { transaction: t }));

    // We don't need to recalculate the votes amount, as the pax type is not set here.

    // The application is saved: the mails about it are sent afterwards, and a failure does not undo it.
    const ids = { application_id: newApplication.id, event_id: req.event.id };
    // Both at once: a mailer that does not answer delays the answer by one timeout, not two.
    await Promise.all([
        mailer.sendMailAfterSave({ template: 'statutory_applied.html', ids }, () => mailer.sendMail({
            to: req.user.notification_email,
            subject: `You've successfully applied for ${req.event.name}`,
            template: 'statutory_applied.html',
            parameters: {
                application: newApplication,
                event: req.event
            }
        })),
        mailer.sendMailAfterSave({ template: 'statutory_board_applied.html', ids }, async () => {
            const boardMembers = await core.getBodyUsersForPermission({
                action: 'approve_members',
                object: req.event.type
            }, newApplication.body_id);

            if (boardMembers.length > 0) {
                await mailer.sendMail({
                    to: boardMembers.map((member) => member.user.notification_email),
                    subject: `One of your body members has applied to ${req.event.name}`,
                    template: 'statutory_board_applied.html',
                    parameters: {
                        application: newApplication,
                        event: req.event
                    }
                });
            }
        })
    ]);

    return res.json({
        success: true,
        data: presentApplication(req, newApplication)
    });
};

exports.exportOpenslides = async (req, res) => {
    // Exporting users to mass-import into OpenSlides.
    // The file structure is CSV file with this headers in the first row:
    // Title, Given name, Surname, Structure level, Participant number, Groups, Comment, Is active, Is present, Is committee, Initial password Email
    // This endpoint will generate passwords for each user. If you do it 2 times, there would
    // be 2 different set of passwords, keep that in mind.
    // For more reference on OpenSlides page, open your OpenSlides instance (or https://demo.openslides.org),
    // then go to Participants -> Import and read the specification at the bottom of the page.

    if (!req.permissions.export.openslides) {
        return errors.makeForbiddenError(res, 'You are not allowed to see statistics.');
    }

    const applications = await Application.findAll({
        where: { event_id: req.event.id, cancelled: false, status: 'accepted' },
    });

    // A CSV field in quotes; a quote inside the value is doubled.
    const wrap = (value) => '"' + String(value).replace(/"/g, '""') + '"';

    const headers = [
        'Title',
        'Given name',
        'Surname',
        'Structure level',
        'Participant number',
        'Groups',
        'Comment',
        'Is active',
        'Is present',
        'Is committee',
        'Initial password',
        'Email'
    ];

    let mails = [];

    if (applications.length > 0) {
        const userIds = applications.map((application) => application.user_id).toString();
        mails = await core.getMails(req, userIds);
    }

    const applicationsString = await Promise.all(applications.map(async (application) => {
        // Generating random pw for a user.
        const password = crypto.randomBytes(5).toString('hex');

        const user = mails.find((m) => application.user_id === m.id);

        if (!user) {
            logger.warn({ user_id: application.user_id }, 'Could not find user');
        }

        return [
            '', // Title
            application.first_name,
            application.last_name,
            '', // Structure level
            application.id, // Participant number
            application.participant_type,
            `Body ID: ${application.body_id} (${application.body_name}). User ID: ${application.user_id}`, // Comment
            1, // Is active
            1, // Is present
            0, // Is committee
            password,
            user ? user.notification_email : ''
        ].map(wrap).join(',');
    }));

    // Returns a CSV string
    const exportString = headers.map(wrap).join(',') + '\n' + applicationsString.filter((line) => line.length > 0).join('\n');

    res.setHeader('Content-type', 'text/csv');
    res.setHeader('Content-disposition', 'attachment; filename=openslides.csv');

    return res.send(exportString);
};

exports.exportAll = async (req, res) => {
    // Exporting users as XLSX for LOs/Chair/CD/whoever.
    if (!['all', 'incoming'].includes(req.params.prefix)) {
        return errors.makeBadRequestError(res, 'The prefix should be "all" or "incoming".');
    }

    if (!req.permissions.export[req.params.prefix]) {
        return errors.makeForbiddenError(res, 'You are not allowed to export participants.');
    }

    req.query.select = helpers.toList(req.query.select);
    if (!Array.isArray(req.query.select)) {
        return errors.makeBadRequestError(res, 'Filters are not provided or are invalid.');
    }

    if (typeof req.query.filter !== 'object') {
        req.query.filter = {};
    }

    // If prefix is /incoming, only specific fields are allowed.
    // If prefix is /all, all fields are available.
    if (req.params.prefix !== 'all') {
        req.query.select = req.query.select.filter((field) => constants.ALLOWED_INCOMING_FIELDS.includes(field));
        req.query.filter = { status: 'accepted' };
    }

    const filterError = helpers.getFilterError(req.query.filter, constants.ALLOWED_APPLICATION_FILTER_FIELDS);
    if (filterError) {
        return errors.makeBadRequestError(res, filterError);
    }

    // Default query is filtering out cancelled applications.
    const defaultFilter = { cancelled: false };

    // Then applying user filter on it.
    const applicationsFilter = Object.assign(defaultFilter, req.query.filter);

    const headersNames = helpers.getApplicationFields(req.event);
    const headers = req.query.select.map((field) => headersNames[field]);

    // The export is always for this event only.
    const applications = await Application.findAll({ where: { ...applicationsFilter, event_id: req.event.id } });

    if (applications.length > 0) {
        const userIds = applications.map((application) => application.user_id).toString();
        const mails = await core.getMails(req, userIds);

        for (const application of applications) {
            const user = mails.find((m) => application.user_id === m.id);

            if (!user) {
                logger.warn({ user_id: application.user_id }, 'Could not find user');
                continue;
            }

            application.dataValues.notification_email = user.notification_email;
        }
    }

    const resultArray = applications
        .map((application) => application.toJSON())
        .map((application) => helpers.flattenObject(application))
        .map((application) => {
            return req.query.select.map((field) => helpers.beautify(application[field]));
        });

    const resultBuffer = xlsx.build([
        {
            name: 'Participants export',
            data: [
                headers,
                ...resultArray
            ]
        }
    ]);

    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-disposition', 'attachment; filename=participants_' + new Date().toISOString() + '.xlsx');

    return res.send(resultBuffer);
};

exports.exportDelegatesJc = async (req, res) => {
    // Exporting delegates as CSV for importing in OMS JC
    if (!req.permissions.export.delegates_jc) {
        return errors.makeForbiddenError(res, 'You are not allowed to export delegates for JC.');
    }

    const applications = await Application.findAll({ where: { event_id: req.event.id, cancelled: false, status: 'accepted', participant_type: 'delegate' } });

    let mails = [];

    if (applications.length > 0) {
        const userIds = applications.map((application) => application.user_id).toString();
        mails = await core.getMails(req, userIds);
    }

    const bodies = await core.getBodies(req);

    // Returns a CSV string
    const exportString = await Promise.all(applications.map(async (application) => {
        const user = mails.find((m) => application.user_id === m.id);
        const body = bodies.find((b) => application.body_id === b.id);
        // The import of this file takes plain letters, dashes and spaces in names;
        // everything else, the field separator included, is replaced.
        const regex = /[^a-zA-Z\- ]/g;
        application.first_name = application.first_name.replace(regex, '?');
        application.last_name = application.last_name.replace(regex, '?');

        return [
            application.statutory_id,
            user ? user.notification_email : '',
            application.first_name,
            application.last_name,
            body ? body.code : '',
            application.participant_type
        ].join(';');
    }));
    const resultString = exportString.filter((line) => line.length > 0).join('\n');

    res.setHeader('Content-type', 'text/csv');
    res.setHeader('Content-disposition', 'attachment; filename=delegates_jc_' + new Date().toISOString() + '.csv');

    return res.send(resultString);
};
