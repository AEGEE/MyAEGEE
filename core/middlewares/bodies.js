const { Body, User, BodyMembership, JoinRequest, Circle, Payment } = require('../models');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const errors = require('../lib/errors');
const { sequelize } = require('../lib/sequelize');

exports.listAllBodies = async (req, res) => {
    if (req.query.all) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'You are not authorized.'
            });
        }

        if (!req.permissions.hasPermission('global:view_deleted:body')) {
            return errors.makeForbiddenError(res, 'Permission global:view_deleted:body is required, but not present.');
        }
    }

    const where = {
        ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.BODY),
        ...helpers.findBy(req.query, constants.FIELDS_TO_FIND.BODY)
    };

    if (!req.query.all) {
        where.status = 'active';
    }

    if (!req.query.sort) {
        req.query.sort = 'name';
    }

    if (!req.user) {
        where.type = ['antenna', 'contact antenna', 'contact'];
    }

    const result = await Body.findAndCountAll({
        where,
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, Body)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getBody = async (req, res) => {
    if (req.currentBody.status === 'deleted' && (!req.user || !req.permissions.hasPermission('view_deleted:body'))) {
        return errors.makeForbiddenError(res, 'Permission view_deleted:body is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.createBody = async (req, res) => {
    if (!req.permissions.hasPermission('global:create:body')) {
        return errors.makeForbiddenError(res, 'Permission global:create:body is required, but not present.');
    }

    const body = await Body.create(helpers.whitelistObject(req.body, constants.FIELDS_TO_UPDATE.BODY.CREATE));
    return res.json({
        success: true,
        data: body
    });
};

exports.updateBody = async (req, res) => {
    if (!req.permissions.hasPermission('update:body')) {
        return errors.makeForbiddenError(res, 'Permission update:body is required, but not present.');
    }

    // Passing the allowed fields as `fields` would make Sequelize validate all of them, also the
    // ones that don't change, so an old value that wouldn't pass validation today (like a website
    // from before links were validated) would block editing anything else.
    const allowedFields = req.permissions.getPermissionFilters('update:body') || constants.FIELDS_TO_UPDATE.BODY.UPDATE;
    const values = helpers.whitelistObject(req.body, allowedFields);

    // New members of the body join its shadow circle, so a new one can only be one of the body's own circles.
    // The stored value is not checked again: clients send the whole body back on every edit.
    const isId = (value) => ['number', 'string'].includes(typeof value) && /^[0-9]+$/.test(String(value));
    const shadowCircleId = isId(values.shadow_circle_id) ? Number(values.shadow_circle_id) : values.shadow_circle_id;

    if (shadowCircleId !== undefined && shadowCircleId !== null && shadowCircleId !== req.currentBody.shadow_circle_id) {
        const circle = isId(shadowCircleId)
            ? await Circle.findOne({ where: { id: shadowCircleId, body_id: req.currentBody.id } })
            : null;

        if (!circle) {
            return errors.makeValidationError(res, { shadow_circle_id: ['The shadow circle should be a circle of this body.'] });
        }
    }

    if (shadowCircleId !== undefined) {
        values.shadow_circle_id = shadowCircleId;
    }

    await req.currentBody.update(values);
    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.setBodyStatus = async (req, res) => {
    if (!req.permissions.hasPermission('global:delete:body')) {
        return errors.makeForbiddenError(res, 'Permission global:delete:body is required, but not present.');
    }

    // TODO: delete all the payments if the body is deleted.
    await sequelize.transaction(async (t) => {
        await req.currentBody.update({ status: req.body.status }, { transaction: t });
        if (req.currentBody.status !== 'deleted') {
            return;
        }

        // Deleting all the stuff related to body.
        await JoinRequest.destroy({
            where: {
                body_id: req.currentBody.id,
                status: 'approved'
            },
            transaction: t
        });
        await BodyMembership.destroy({ where: { body_id: req.currentBody.id }, transaction: t });
        await Circle.destroy({ where: { body_id: req.currentBody.id }, transaction: t });
        await Payment.destroy({ where: { body_id: req.currentBody.id }, transaction: t });
    });

    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.createMember = async (req, res) => {
    if (!req.permissions.hasPermission('create_member:body')) {
        return errors.makeForbiddenError(res, 'Permission create_member:body is required, but not present.');
    }

    // TODD: send mail to a user

    // Confirming user by default
    const password = await helpers.getRandomBytes(constants.TOKEN_LENGTH.PASSWORD);
    const user = await User.create({
        ...req.body,
        password,
        mail_confirmed_at: new Date()
    }, {
        fields: [
            ...constants.FIELDS_TO_UPDATE.USER.CREATE,
            'mail_confirmed_at'
        ]
    });

    const membership = await BodyMembership.create({
        user_id: user.id,
        body_id: req.currentBody.id
    });

    return res.json({
        success: true,
        data: membership
    });
};

// This endpoint is for creating bound circles only.
exports.createBoundCircle = async (req, res) => {
    if (!req.permissions.hasPermission('create:circle')) {
        return errors.makeForbiddenError(res, 'Permission create:circle is required, but not present.');
    }

    const circle = await Circle.create({
        ...helpers.whitelistObject(req.body, constants.FIELDS_TO_UPDATE.CIRCLE.CREATE),
        body_id: req.currentBody.id
    });

    return res.json({
        success: true,
        data: circle
    });
};
