const { Permission, CircleMembership, Circle, User } = require('../models');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');
const constants = require('../lib/constants');
const { Sequelize } = require('../lib/sequelize');

exports.listAllPermissions = async (req, res) => {
    const result = await Permission.findAndCountAll({
        where: helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.PERMISSION),
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, Permission)
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

    const permission = await Permission.create(helpers.whitelistObject(req.body, constants.FIELDS_TO_UPDATE.PERMISSION.CREATE));
    return res.json({
        success: true,
        data: permission
    });
};

exports.updatePermission = async (req, res) => {
    if (!req.permissions.hasPermission('global:update:permission')) {
        return errors.makeForbiddenError(res, 'Permission global:update:permission is required, but not present.');
    }

    await req.currentPermission.update(helpers.whitelistObject(req.body, constants.FIELDS_TO_UPDATE.PERMISSION.UPDATE));
    await req.currentPermission.reload();
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
    const circleIds = permissionCircles.map((circle) => circle.id);

    // Two kinds of members have the permission: the members of a circle that has it,
    // directly or through a parent circle, and the superadmins.
    // The members are looked up first, so the list itself can be counted and cut into pages
    // by member, and not by the rows of the tables that are joined to it.
    const holders = await CircleMembership.findAll({
        where: { circle_id: { [Sequelize.Op.in]: circleIds } },
        attributes: ['user_id']
    });
    const holderIds = [...new Set(holders.map((membership) => membership.user_id))];

    const result = await User.findAndCountAll({
        where: {
            [Sequelize.Op.or]: [
                { id: { [Sequelize.Op.in]: holderIds } },
                { superadmin: true }
            ],
            // The circles have a `gsuite_id` too, so the fields are named with their table.
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER.map((field) => 'user.' + field))
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, User),
        distinct: true,
        include: [
            // Only the memberships that give the permission.
            {
                model: CircleMembership,
                where: { circle_id: { [Sequelize.Op.in]: circleIds } },
                required: false,
                separate: true
            },
            { model: Circle, as: 'circles' }
        ]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};
