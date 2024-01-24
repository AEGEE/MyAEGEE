const moment = require('moment');
const _ = require('lodash');
const request = require('request-promise-native');

const { User, Body, MailChange, MailConfirmation } = require('../models');
const config = require('../config');
const constants = require('../lib/constants');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');
const mailer = require('../lib/mailer');
const { sequelize, Sequelize } = require('../lib/sequelize');

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

exports.searchAllUsers = async (req, res) => {
    if (!req.permissions.hasPermission('global:search:member')) {
        return errors.makeForbiddenError(res, 'Permission global:search:member is required, but not present.');
    }

    const result = await User.findAndCountAll({
        where: helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER),
        ...helpers.getPagination(req.query),
        attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'gsuite_id'],
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
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

    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.getUsersEmail = async (req, res) => {
    if (!req.permissions.hasPermission('global:mail:member')) {
        return errors.makeForbiddenError(res, 'Permission global:mail:member is required, but not present.');
    }

    if (req.query.query && !req.query.query.match(/^\d+(?:,\d+)*$/g)) {
        return errors.makeBadRequestError(res, 'Query should be a string of 1 id or multiple ids seperated by commas.');
    }

    let where = {};

    if (typeof req.query.query === 'string' && req.query.query.trim().length > 0) {
        where = { id: { [Sequelize.Op.or]: req.query.query.split(',') } };
    }

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

    await req.currentUser.update(req.body, { fields: constants.FIELDS_TO_UPDATE.USER.UPDATE });
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
    if (!req.permissions.hasPermission('update_active:member')) {
        return errors.makeForbiddenError(res, 'Permission update_active:member is required, but not present.');
    }

    await req.currentUser.update({ active: req.body.active });
    return res.json({
        success: true,
        data: req.currentUser
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

exports.triggerEmailChange = async (req, res) => {
    if (!req.permissions.hasPermission('update:member') && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission update:member is required, but not present.');
    }

    if (!req.body.new_email) {
        return errors.makeBadRequestError(res, 'No new email is provided.');
    }

    if (constants.RESTRICTED_EMAILS.some((email) => req.body.new_email.includes(email))) {
        return errors.makeValidationError(res, 'New email can not be in one of the following domains: ' + constants.RESTRICTED_EMAILS.join(', ').trim() + '.');
    }

    const existingMail = await User.findOne({
        where: {
            email: {
                [Sequelize.Op.iLike]: req.body.new_email.trim()
            }
        }
    });

    if (existingMail) {
        return errors.makeValidationError(res, 'User with this email already exists.');
    }

    await sequelize.transaction(async (t) => {
        const mailChange = await MailChange.createForUser(req.currentUser, req.body.new_email, t);

        await mailer.sendMail({
            to: req.body.new_email,
            subject: constants.MAIL_SUBJECTS.MAIL_CHANGE,
            template: 'mail_change.html',
            parameters: {
                token: mailChange.value
            }
        });
    });

    return res.json({
        success: true,
        message: 'The mail change was triggered. Check your email.'
    });
};

exports.confirmEmailChange = async (req, res) => {
    const mailChange = await MailChange.findOne({
        where: { value: (req.body.token || '').trim() },
        include: [User]
    });

    if (!mailChange) {
        return errors.makeNotFoundError(res, 'Token is invalid.');
    }

    if (moment(mailChange.expires_at).isBefore(moment())) {
        return errors.makeNotFoundError(res, 'Token is expired.');
    }

    await sequelize.transaction(async (t) => {
        await mailChange.user.update({ email: mailChange.new_email }, { transaction: t });
        await mailChange.destroy({ transaction: t });
    });

    return res.json({
        success: true,
        message: 'Mail was changed successfully.'
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
        await request({
            url: config.listserv_endpoint,
            method: 'POST',
            simple: false,
            form: {
                token: config.listserv_token,
                email: req.user.notification_email,
                name: `${req.user.first_name} ${req.user.last_name}`,
                lists: mailinglists.join(','),
            }
        });
    } catch (err) {
        return errors.makeInternalError(res, err);
    }

    return res.json({
        success: true,
        message: `Request for subscribing to ${mailinglists.join(', ')} has been sent.`
    });
};
