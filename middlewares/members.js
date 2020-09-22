const moment = require('moment');

const { User, Body, MailChange } = require('../models');
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

exports.getUser = async (req, res) => {
    if (!req.permissions.hasPermission('view:member') && req.user.id !== req.currentUser.id) {
        return errors.makeForbiddenError(res, 'Permission view:member is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentUser
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

// TODO: reimplement by not deleting, but anonymizing a user.
// exports.deleteUser = async (req, res) => {
//     // TODO: check permissions
//     await req.currentUser.destroy();
//     return res.json({
//         success: true,
//         data: 'User is deleted.'
//     });
// };

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
