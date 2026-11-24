const moment = require('moment');
const _ = require('lodash');
const { request } = require('../lib/http');

const { User, Body, BodyMembership, MailChange, MailConfirmation, EventApplicationBan, PasswordReset } = require('../models');
const config = require('../config');
const constants = require('../lib/constants');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');
const mailer = require('../lib/mailer');
const { sequelize, Sequelize } = require('../lib/sequelize');

const MAX_EVENT_APPLICATION_BAN_MONTHS = 3;

function canViewEventApplicationBan(req, user) {
    return req.user.id === user.id || req.permissions.hasPermission('global:update_application_ban:member');
}

async function addActiveEventApplicationBan(req, user) {
    if (!canViewEventApplicationBan(req, user)) {
        delete user.dataValues.event_application_ban;
        return user;
    }

    user.dataValues.event_application_ban = await EventApplicationBan.findActiveForUser(user.id);
    return user;
}

exports.listAllUsers = async (req, res) => {
    if (!req.permissions.hasPermission('global:view:member')) {
        return errors.makeForbiddenError(res, 'Permission global:view:member is required, but not present.');
    }

    const result = await User.findAndCountAll({
        where: helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER),
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

// Parses `body_id` (comma-separated) into unique, positive integer IDs, ignoring invalid values.
// Returns null if the parameter is not a string (e.g. repeated in the query string).
function parseBodyIds(bodyIdParam) {
    if (typeof bodyIdParam === 'undefined') {
        return [];
    }

    if (typeof bodyIdParam !== 'string') {
        return null;
    }

    const ids = bodyIdParam.split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9]+$/.test(id))
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0);

    return [...new Set(ids)];
}

// Search for callers without global:view:member: names only (no wildcards), or an exact email.
function limitedSearchFilter(query) {
    const escaped = query.replace(/[\\%_]/g, (char) => '\\' + char);

    return {
        [Sequelize.Op.or]: [
            Sequelize.where(
                Sequelize.fn('concat', Sequelize.col('first_name'), ' ', Sequelize.col('last_name')),
                { [Sequelize.Op.iLike]: '%' + escaped + '%' }
            ),
            Sequelize.where(Sequelize.fn('lower', Sequelize.col('email')), query.toLowerCase())
        ]
    };
}

// Searches members. Two ways to use it:
// - with global:search:member: across all members, optionally filtered by `body_id`;
// - without it: `body_id` (comma-separated, at most MEMBERS_SEARCH.MAX_BODIES) is required and
//   the caller has to be a member of at least one of those bodies. Results are limited to
//   members of those bodies.
// Holders of global:view:member search names, emails and GSuite IDs and get contact fields.
// Everyone else searches by name (or an exact email), needs a query of at least
// MEMBERS_SEARCH.MIN_QUERY_LENGTH characters, gets at most MEMBERS_SEARCH.MAX_LIMIT results
// with only ids and names, and no total count.
exports.searchAllUsers = async (req, res) => {
    const canSearchAll = req.permissions.hasPermission('global:search:member');
    const canViewMembers = req.permissions.hasPermission('global:view:member');

    const bodyIds = parseBodyIds(req.query.body_id);
    if (bodyIds === null) {
        return errors.makeBadRequestError(res, 'body_id should be a comma-separated list of body IDs.');
    }

    if (!canSearchAll) {
        if (bodyIds.length === 0) {
            return errors.makeForbiddenError(res, 'Permission global:search:member is required to search without body_id.');
        }

        if (bodyIds.length > constants.MEMBERS_SEARCH.MAX_BODIES) {
            return errors.makeBadRequestError(res, `You can search at most ${constants.MEMBERS_SEARCH.MAX_BODIES} bodies at once.`);
        }

        const userBodyIds = req.user.bodies.map((body) => body.id);
        if (!bodyIds.some((id) => userBodyIds.includes(id))) {
            return errors.makeForbiddenError(res, 'You can only search members of bodies you are a member of.');
        }
    }

    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!canViewMembers && query.length < constants.MEMBERS_SEARCH.MIN_QUERY_LENGTH) {
        return res.json({
            success: true,
            data: [],
            meta: {}
        });
    }

    const pagination = helpers.getPagination(req.query);
    if (!canViewMembers) {
        pagination.limit = Math.min(pagination.limit || constants.MEMBERS_SEARCH.MAX_LIMIT, constants.MEMBERS_SEARCH.MAX_LIMIT);
    }

    // Only sort by returned fields: sorting by anything else (like email) would leak its order.
    const fields = canViewMembers ? constants.MEMBERS_SEARCH.FIELDS_WITH_VIEW_MEMBER : constants.MEMBERS_SEARCH.FIELDS;
    const order = helpers.getSorting(req.query);
    if (!fields.includes(order[0][0])) {
        order[0][0] = 'id';
    }

    // When filtering by body, only return users who are members of at least one of the bodies.
    const include = [];
    if (bodyIds.length > 0) {
        include.push({
            model: BodyMembership,
            where: { body_id: { [Sequelize.Op.in]: bodyIds } },
            attributes: [],
            required: true
        });
    }

    const result = await User.findAndCountAll({
        where: canViewMembers ? helpers.filterBy(query, constants.FIELDS_TO_QUERY.MEMBER) : limitedSearchFilter(query),
        ...pagination,
        attributes: fields,
        include,
        order,
        ...(include.length > 0 && { distinct: true })
    });

    return res.json({
        success: true,
        data: result.rows,
        // The total count would reveal how many members match (or how big a body is).
        meta: canViewMembers ? { count: result.count } : {}
    });
};

exports.listAllUnconfirmedUsers = async (req, res) => {
    if (!req.permissions.hasPermission('global:view_unconfirmed:member')) {
        return errors.makeForbiddenError(res, 'Permission global:view_unconfirmed:member is required, but not present.');
    }

    const result = await User.findAndCountAll({
        where: {
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER),
            mail_confirmed_at: null
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getUser = async (req, res) => {
    if (!req.permissions.hasPermission('view:member') && req.user.id !== req.currentUser.id) {
        if (req.permissions.hasPermission('view_members:body')) {
            return res.json({
                success: true,
                data: {
                    id: req.currentUser.id,
                    first_name: req.currentUser.first_name,
                    last_name: req.currentUser.last_name,
                    email: req.currentUser.email,
                    notification_email: req.currentUser.notification_email
                }
            });
        }
        return errors.makeForbiddenError(res, 'Permission view:member is required, but not present.');
    }

    await addActiveEventApplicationBan(req, req.currentUser);

    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.lookupUser = async (req, res) => {
    if (!req.permissions.hasPermission('lookup:member')
        && !req.permissions.hasPermission('view:member')
        && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission lookup:member is required, but not present.');
    }

    return res.json({
        success: true,
        data: {
            id: req.currentUser.id,
            first_name: req.currentUser.first_name,
            last_name: req.currentUser.last_name,
            username: req.currentUser.username,
            email: req.currentUser.email,
            gsuite_id: req.currentUser.gsuite_id,
            notification_email: req.currentUser.notification_email
        }
    });
};

exports.getUsersEmail = async (req, res) => {
    const correctQuery = req.query.query && typeof req.query.query === 'string' && req.query.query.trim().length > 0 && req.query.query.match(/^\d+(?:,\d+)*$/g);

    if (!correctQuery) {
        return errors.makeBadRequestError(res, 'Query should be a string of 1 id or multiple ids seperated by commas.');
    }

    const userIds = req.query.query.split(',');

    // Without the permission, a member can only look up their own id.
    const onlyOwnId = userIds.every((id) => Number(id) === req.user.id);
    if (!req.permissions.hasPermission('global:mail:member') && !onlyOwnId) {
        return errors.makeForbiddenError(res, 'Permission global:mail:member is required, but not present.');
    }

    const where = { id: { [Sequelize.Op.or]: userIds } };

    const result = await User.findAndCountAll({
        where,
        attributes: ['id', 'email', 'gsuite_id', 'primary_email', 'notification_email']
    });

    return res.json({
        success: true,
        data: result.rows.map((row) => _.pick(row, ['id', 'notification_email'])),
        meta: { count: result.count }
    });
};

exports.updateUser = async (req, res) => {
    if (!req.permissions.hasPermission('update:member') && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission update:member is required, but not present.');
    }

    // The Google Workspace account is managed centrally. From anyone else the field is ignored
    // and not refused, because clients send the whole profile back on every edit.
    const fields = req.permissions.hasPermission('global:update:member')
        ? constants.FIELDS_TO_UPDATE.USER.UPDATE
        : constants.FIELDS_TO_UPDATE.USER.UPDATE.filter((field) => field !== 'gsuite_id');

    // The primary email can only be the Google Workspace account for a member who has one.
    // Checked here and not on the model, so a member who is stored otherwise can still be edited.
    const usesWorkspaceWithoutAccount = (values) => values.primary_email === 'gsuite' && !values.gsuite_id;
    const current = _.pick(req.currentUser, ['primary_email', 'gsuite_id']);
    const updated = { ...current, ..._.pick(req.body, fields.filter((field) => field in current)) };

    if (usesWorkspaceWithoutAccount(updated) && !usesWorkspaceWithoutAccount(current)) {
        return errors.makeValidationError(res, {
            primary_email: ['The primary email can only be the Google Workspace account for a member who has one.']
        });
    }

    await req.currentUser.update(req.body, { fields });
    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.deleteUser = async (req, res) => {
    if (!req.permissions.hasPermission('delete:member')) {
        return errors.makeForbiddenError(res, 'Permission delete:member is required, but not present.');
    }

    await req.currentUser.destroy();
    return res.json({
        success: true,
        message: 'User is deleted.'
    });
};

exports.setUserPassword = async (req, res) => {
    if (!req.permissions.hasPermission('update:member') && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission update:member is required, but not present.');
    }

    const userWithPassword = await User.scope('withPassword').findByPk(req.currentUser.id);

    if (!await userWithPassword.checkPassword(req.body.old_password)) {
        return errors.makeValidationError(res, 'The old password is invalid.');
    }

    await userWithPassword.update({ password: req.body.password });

    // TODO: add a mail that the password was changed.

    return res.json({
        success: true,
        message: 'The password was changed.'
    });
};

exports.setUserActive = async (req, res) => {
    if (!req.permissions.hasPermission('global:update_active:user')) {
        return errors.makeForbiddenError(res, 'Permission global:update_active:user is required, but not present.');
    }

    if (req.currentUser.superadmin && !req.user.superadmin) {
        return errors.makeForbiddenError(res, 'Only a superadmin can suspend or activate a superadmin.');
    }

    if (req.currentUser.id === req.user.id) {
        return errors.makeValidationError(res, 'You cannot suspend yourself.');
    }

    await req.currentUser.update({ active: req.body.active });
    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.setEventApplicationBan = async (req, res) => {
    if (!req.permissions.hasPermission('global:update_application_ban:member')) {
        return errors.makeForbiddenError(res, 'Permission global:update_application_ban:member is required, but not present.');
    }

    const banUntil = moment(req.body.ban_until);
    if (!banUntil.isValid()) {
        return errors.makeValidationError(res, { ban_until: ['Ban end date should be valid.'] });
    }

    if (banUntil.isSameOrBefore(moment())) {
        return errors.makeValidationError(res, { ban_until: ['Ban end date should be in the future.'] });
    }

    if (banUntil.isAfter(moment().add(MAX_EVENT_APPLICATION_BAN_MONTHS, 'months'))) {
        return errors.makeValidationError(res, { ban_until: ['Ban end date cannot be more than 3 months in the future.'] });
    }

    await sequelize.transaction(async (t) => {
        await EventApplicationBan.update({
            lifted_at: new Date(),
            lifted_by_user_id: req.user.id
        }, {
            where: {
                user_id: req.currentUser.id,
                lifted_at: null
            },
            transaction: t
        });

        await EventApplicationBan.create({
            user_id: req.currentUser.id,
            banned_by_user_id: req.user.id,
            ban_until: banUntil.toDate()
        }, { transaction: t });
    });

    await addActiveEventApplicationBan(req, req.currentUser);

    return res.json({
        success: true,
        data: req.currentUser.dataValues.event_application_ban
    });
};

exports.liftEventApplicationBan = async (req, res) => {
    if (!req.permissions.hasPermission('global:update_application_ban:member')) {
        return errors.makeForbiddenError(res, 'Permission global:update_application_ban:member is required, but not present.');
    }

    const activeBan = await EventApplicationBan.findActiveForUser(req.currentUser.id);
    if (!activeBan) {
        return errors.makeNotFoundError(res, 'This user does not have an active event application ban.');
    }

    await activeBan.update({
        lifted_at: new Date(),
        lifted_by_user_id: req.user.id
    });

    return res.json({
        success: true,
        message: 'Event application ban was lifted.'
    });
};

exports.setUserSuperadmin = async (req, res) => {
    if (!req.permissions.hasPermission('global:update_superadmin:member')) {
        return errors.makeForbiddenError(res, 'Permission global:update_superadmin:member is required, but not present.');
    }

    await req.currentUser.update({ superadmin: req.body.superadmin });
    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.confirmUser = async (req, res) => {
    if (!req.permissions.hasPermission('global:confirm:member')) {
        return errors.makeForbiddenError(res, 'Permission global:confirm:member is required, but not present.');
    }

    await req.currentUser.update({ mail_confirmed_at: new Date() });

    const confirmation = await MailConfirmation.findOne({
        where: { user_id: req.currentUser.id }
    });

    await confirmation.destroy();

    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.setPrimaryBody = async (req, res) => {
    if (!req.permissions.hasPermission('update:member') && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission update:member is required, but not present.');
    }

    if (req.body.primary_body_id) {
        const body = await Body.findByPk(req.body.primary_body_id);
        if (!body) {
            return errors.makeNotFoundError(res, 'Body is not found.');
        }

        if (!req.currentUser.bodies.some((b) => b.id === body.id)) {
            return errors.makeForbiddenError(res, 'User is not a member of this body.');
        }

        await req.currentUser.update({ primary_body_id: body.id });
    } else {
        await req.currentUser.update({ primary_body_id: null });
    }

    return res.json({
        success: true,
        data: req.currentUser
    });
};

// Email changes of one member are processed one by one. An advisory lock does that without
// locking the member's row, which every request of that member writes to (last_active), so
// the member is not held up while the mails are sent.
const MAIL_CHANGE_LOCK_NAMESPACE = 1;
const lockMailChanges = (userId, transaction) => sequelize.query(
    'SELECT pg_advisory_xact_lock(:namespace, :user_id)',
    { replacements: { namespace: MAIL_CHANGE_LOCK_NAMESPACE, user_id: userId }, transaction }
);

// Requests a change of the login email. The new address always has to confirm it. If somebody
// else requests it for the member, the member's current address has to confirm it as well,
// unless the requester has global:update:member.
exports.triggerEmailChange = async (req, res) => {
    const isOwnChange = req.user.id === req.currentUser.id;

    if (!req.permissions.hasPermission('update:member') && !isOwnChange) {
        return errors.makeForbiddenError(res, 'Permission update:member is required, but not present.');
    }

    const newEmail = typeof req.body.new_email === 'string' ? req.body.new_email.trim() : '';
    if (!newEmail) {
        return errors.makeBadRequestError(res, 'No new email is provided.');
    }

    if (helpers.isRestrictedEmail(newEmail)) {
        return errors.makeValidationError(res, 'New email can not be in one of the following domains: ' + constants.RESTRICTED_EMAILS.join(', ').trim() + '.');
    }

    const existingMail = await User.findOne({
        where: helpers.equalsIgnoreCase('email', newEmail)
    });

    if (existingMail) {
        return errors.makeValidationError(res, 'User with this email already exists.');
    }

    const needsOldConfirmation = !isOwnChange && !req.permissions.hasPermission('global:update:member');
    const requestedBy = isOwnChange ? null : req.user.id;
    const names = {
        name: req.currentUser.first_name,
        surname: req.currentUser.last_name
    };

    // The mail to the current address tells who asks and through which of the member's bodies.
    let requesterBodies = [];
    if (needsOldConfirmation) {
        const bodyIds = await req.permissions.fetchUserPermissionBodyIds(req.currentUser, 'update:member');
        requesterBodies = await Body.findAll({
            where: { id: { [Sequelize.Op.in]: bodyIds } },
            attributes: ['name'],
            order: [['name', 'ASC']]
        });
    }

    await sequelize.transaction(async (t) => {
        // Requests for one member at the same time are processed one by one.
        await lockMailChanges(req.currentUser.id, t);

        // There's at most one pending change per member and requester: a new request replaces the earlier one.
        await MailChange.destroy({
            where: { user_id: req.currentUser.id, requested_by: requestedBy },
            transaction: t
        });

        const mailChange = await MailChange.createForUser(req.currentUser, newEmail, {
            requestedBy,
            needsOldConfirmation,
            transaction: t
        });

        await mailer.sendMail({
            to: mailChange.new_email,
            subject: constants.MAIL_SUBJECTS.MAIL_CHANGE,
            template: 'mail_change.html',
            parameters: {
                ...names,
                token: mailChange.value
            }
        });

        if (needsOldConfirmation) {
            await mailer.sendMail({
                to: req.currentUser.email,
                subject: constants.MAIL_SUBJECTS.MAIL_CHANGE_OLD_CONFIRM,
                template: 'mail_change_old_confirm.html',
                parameters: {
                    ...names,
                    new_email: mailChange.new_email,
                    requester_name: `${req.user.first_name} ${req.user.last_name}`,
                    requester_body: requesterBodies.map((body) => body.name).join(', '),
                    token: mailChange.old_value
                }
            });
        }
    });

    return res.json({
        success: true,
        message: needsOldConfirmation
            ? 'The email change was requested. The member has to confirm it from both their current address '
                + 'and the new address; a mail was sent to each. If the member can no longer read their current address, '
                + 'ask the MyAEGEE Helpdesk (http://aegee.org/helpdesk) to change the email: it can do that without this confirmation.'
            : 'The email change was requested. It takes effect after it is confirmed from the new address.',
        data: { needs_old_address_confirmation: needsOldConfirmation }
    });
};

// Confirms a change of the login email with the token that was sent to the new address or the
// one that was sent to the current address. The email changes once every address that has
// to confirm has done so, and the old address is told about it.
exports.confirmEmailChange = async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
        return errors.makeNotFoundError(res, 'Token is invalid.');
    }

    const tokenMatches = { [Sequelize.Op.or]: [{ value: token }, { old_value: token }] };

    // The transaction locks the member first and the change after that, so it needs to know the member.
    const found = await MailChange.findOne({ where: tokenMatches, attributes: ['id', 'user_id'] });
    if (!found) {
        return errors.makeNotFoundError(res, 'Token is invalid.');
    }

    const result = await sequelize.transaction(async (t) => {
        // Confirmations at the same time (from both addresses, or of several changes
        // of one member) are processed one by one.
        await lockMailChanges(found.user_id, t);
        const user = await User.findByPk(found.user_id, { transaction: t });
        const mailChange = await MailChange.findOne({
            where: { id: found.id, ...tokenMatches },
            lock: t.LOCK.UPDATE,
            transaction: t
        });

        // It can be gone by now, if another change of the member just took effect.
        if (!user || !mailChange) {
            return { notFound: 'Token is invalid.' };
        }

        if (moment(mailChange.expires_at).isBefore(moment())) {
            return { notFound: 'Token is expired.' };
        }

        // A change only counts for the login address it was requested for.
        if (user.email.toLowerCase() !== mailChange.old_email.toLowerCase()) {
            return { notFound: 'Token is invalid.' };
        }

        const confirmedField = mailChange.value === token ? 'new_confirmed_at' : 'old_confirmed_at';
        if (!mailChange[confirmedField]) {
            await mailChange.update({ [confirmedField]: new Date() }, { transaction: t });
        }

        const waitingFor = mailChange.waitingFor();
        if (waitingFor) {
            return { waitingFor };
        }

        const existingMail = await User.findOne({
            where: helpers.equalsIgnoreCase('email', mailChange.new_email),
            transaction: t
        });

        if (existingMail) {
            return { emailTaken: true };
        }

        const requester = mailChange.requested_by
            ? await User.findByPk(mailChange.requested_by, { transaction: t })
            : null;

        // The notice goes to the address which is replaced, and to the one notifications go to, if that's another one.
        const recipients = [user.email];
        if (user.notification_email && user.notification_email.toLowerCase() !== user.email.toLowerCase()) {
            recipients.push(user.notification_email);
        }

        // Including the other pending changes of the member: they were requested for the previous address.
        await MailChange.destroy({ where: { user_id: user.id }, transaction: t });

        // The notice is sent before the member's row is written, so that row is not locked
        // while the mailer answers. If the mail fails, nothing is changed.
        await mailer.sendMail({
            to: recipients.length === 1 ? recipients[0] : recipients,
            subject: constants.MAIL_SUBJECTS.MAIL_CHANGE_NOTICE,
            template: 'mail_change_notice.html',
            parameters: {
                name: user.first_name,
                surname: user.last_name,
                new_email: mailChange.new_email,
                changed_by: requester ? `${requester.first_name} ${requester.last_name}` : 'yourself'
            }
        });

        await user.update({ email: mailChange.new_email }, { transaction: t });

        // A password reset goes to the login address, so the ones which were sent to the
        // previous address end here. The member's sessions stay.
        await PasswordReset.destroy({ where: { user_id: user.id }, transaction: t });

        return { changed: true };
    });

    if (result.notFound) {
        return errors.makeNotFoundError(res, result.notFound);
    }

    if (result.emailTaken) {
        return errors.makeValidationError(res, { email: ['User with this email already exists.'] });
    }

    if (result.waitingFor) {
        return res.json({
            success: true,
            message: result.waitingFor === 'old_email'
                ? 'Confirmed. The email changes after the current address of the member confirms it too.'
                : 'Confirmed. The email changes after the new address confirms it too.',
            data: { changed: false, waiting_for: result.waitingFor }
        });
    }

    return res.json({
        success: true,
        message: 'Mail was changed successfully.',
        data: { changed: true }
    });
};

exports.subscribeListserv = async (req, res) => {
    if (!req.permissions.hasPermission('global:subscribe:listserv') && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission update:member is required, but not present.');
    }

    if (!req.body.mailinglists) {
        return errors.makeBadRequestError(res, 'No mailinglists are provided.');
    }

    if (!Array.isArray(req.body.mailinglists)) {
        return errors.makeBadRequestError(res, 'Mailinglists must be an array of strings.');
    }

    if (req.body.mailinglists.length === 0) {
        return errors.makeValidationError(res, 'Mailinglists must not be empty.');
    }

    const mailinglists = req.body.mailinglists.map((list) => list.toUpperCase());

    if (mailinglists.some((list) => !constants.LISTSERV_LISTS.includes(list))) {
        return errors.makeValidationError(res, `Mailinglists must be one of the following: ${constants.LISTSERV_LISTS.join(', ')}.`);
    }

    try {
        const response = await request({
            url: config.listserv_endpoint,
            method: 'POST',
            form: {
                token: config.listserv_token,
                email: req.user.notification_email,
                name: `${req.user.first_name} ${req.user.last_name}`,
                lists: mailinglists.join(','),
            },
            fullResponse: true
        });

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`Listserv responded with status ${response.statusCode}.`);
        }
    } catch (err) {
        return errors.makeInternalError(res, err);
    }

    return res.json({
        success: true,
        message: `Request for subscribing to ${mailinglists.join(', ')} has been sent.`
    });
};
