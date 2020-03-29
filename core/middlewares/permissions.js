const { Permission, CircleMembership, Circle, User } = require('../models');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');
const constants = require('../lib/constants');
const { Sequelize } = require('../lib/sequelize');

exports.listAllPermissions = async (req, res) => {
    const result = await Permission.findAndCountAll({
        where: helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.PERMISSION),
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getPermission = async (req, res) => {
    return res.json({
        success: true,
        data: req.currentPermission
    });
};

exports.createPermission = async (req, res) => {
    if (!req.permissions.hasPermission('global:create:permission')) {
        return errors.makeForbiddenError(res, 'Permission global:create:permission is required, but not present.');
    }

    const permission = await Permission.create(req.body);
    return res.json({
        success: true,
        data: permission
    });
};

exports.updatePermission = async (req, res) => {
    if (!req.permissions.hasPermission('global:update:permission')) {
        return errors.makeForbiddenError(res, 'Permission global:update:permission is required, but not present.');
    }

    await req.currentPermission.update(req.body);
    return res.json({
        success: true,
        data: req.currentPermission
    });
};

exports.deletePermission = async (req, res) => {
    if (!req.permissions.hasPermission('global:delete:permission')) {
        return errors.makeForbiddenError(res, 'Permission global:delete:permission is required, but not present.');
    }

    await req.currentPermission.destroy();
    return res.json({
        success: true,
        message: 'Permission is deleted.'
    });
};

exports.getPermissionMembers = async (req, res) => {
    if (!req.permissions.hasPermission('global:view:member')) {
        return errors.makeForbiddenError(res, 'Permission global:view:member is required, but not present.');
    }

    const permissionCircles = await req.permissions.fetchPermissionCircles(req.currentPermission);

    // oh boy.
    // 2 cases: when a person is member of one of the circles
    // that has this permission directly or indirectly,
    // and superadmins.
    const result = await User.findAndCountAll({
        where: {
            [Sequelize.Op.or]: [
                {
                    '$circle_memberships.circle_id$': {
                        [Sequelize.Op.in]: permissionCircles.map((circle) => circle.id)
                    }
                },
                { superadmin: true }
            ],
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query),
        include: [
            CircleMembership,
            { model: Circle, as: 'circles' }
        ]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};
