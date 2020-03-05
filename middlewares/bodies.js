const { Body, User, BodyMembership } = require('../models');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const errors = require('../lib/errors');

exports.listAllBodies = async (req, res) => {
    const result = await Body.findAndCountAll({
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getBody = async (req, res) => {
    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.createBody = async (req, res) => {
    if (!req.permissions.hasPermission('global:create:body')) {
        return errors.makeForbiddenError(res, 'Permission global:create:body is required, but not present.');
    }

    // TODO: filter out fields that are changed in the other way
    const body = await Body.create(req.body);
    return res.json({
        success: true,
        data: body
    });
};

exports.updateBody = async (req, res) => {
    if (!req.permissions.hasPermission('update:body')) {
        return errors.makeForbiddenError(res, 'Permission update:body is required, but not present.');
    }

    await req.currentBody.update(req.body, { fields: req.permissions.getPermissionFilters('update:body') });
    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.setBodyStatus = async (req, res) => {
    if (!req.permissions.hasPermission('global:delete:body')) {
        return errors.makeForbiddenError(res, 'Permission global:delete:body is required, but not present.');
    }

    // TODO: delete all the join requests, payments, body memberships and circle memberships
    // if the body is deleted.
    await req.currentBody.update({ status: req.body.status });
    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.createMember = async (req, res) => {
    // TODO: check permissions
    // TODD: send mail to a user

    // Confirming user by default
    const password = await helpers.getRandomBytes(constants.TOKEN_LENGTH.PASSWORD);
    const user = await User.create({
        ...req.body,
        password,
        mail_confirmed_at: new Date()
    }, { fields: constants.FIELDS_TO_UPDATE.USER.CREATE });

    const membership = await BodyMembership.create({
        user_id: user.id,
        body_id: req.currentBody.id
    });

    return res.json({
        success: true,
        data: membership
    });
};
