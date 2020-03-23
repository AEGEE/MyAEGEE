const { User } = require('../models');
const constants = require('../lib/constants');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');

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
        return errors.makeForbiddenError(res, 'The old password is invalid.');
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
