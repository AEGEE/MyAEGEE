const {
    Permission,
    BodyMembership,
    CircleMembership,
    Circle,
    User
} = require('../models');
const helpers = require('../lib/helpers');
const { Sequelize } = require('../lib/sequelize');
const constants = require('../lib/constants');
const errors = require('../lib/errors');

exports.listAllMemberships = async (req, res) => {
    if (req.query.holds_permission) {
        return exports.listAllMembershipsWithPermission(req, res);
    }

    if (!req.permissions.hasPermission('view_members:body')) {
        return errors.makeForbiddenError(res, 'Permission view_members:body is required, but not present.');
    }

    const result = await BodyMembership.findAndCountAll({
        where: {
            body_id: req.currentBody.id,
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.BODY_MEMBERSHIP)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query),
        include: [User]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.listAllMembershipsWithPermission = async (req, res) => {
    if (!req.permissions.hasPermission('view_members:body')) {
        return errors.makeForbiddenError(res, 'Permission view_members:body is required, but not present.');
    }

    if (!req.query.holds_permission.action || !req.query.holds_permission.object) {
        return errors.makeBadRequestError(res, 'Action or object is not specified.');
    }

    const permission = await Permission.findOne({
        where: {
            scope: 'local',
            action: req.query.holds_permission.action,
            object: req.query.holds_permission.object
        }
    });

    if (!permission) {
        return errors.makeNotFoundError(res, 'Permission is not found.');
    }

    const circles = await req.permissions.fetchPermissionCircles(permission);
    const circleIds = circles.map((circle) => circle.id);

    const result = await BodyMembership.findAndCountAll({
        where: {
            body_id: req.currentBody.id,
            '$user.circle_memberships.circle_id$': { [Sequelize.Op.in]: circleIds },
            '$user.circle_memberships.circle.body_id$': req.currentBody.id,
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.BODY_MEMBERSHIP)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query),
        include: [{
            model: User,
            include: [{
                model: CircleMembership,
                include: [Circle]
            }]
        }]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getMembership = async (req, res) => {
    if (!req.permissions.hasPermission('view_members:body')) {
        return errors.makeForbiddenError(res, 'Permission view_members:body is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentBodyMembership
    });
};

exports.createMembership = async (req, res) => {
    if (!req.permissions.hasPermission('add_member:body')) {
        return errors.makeForbiddenError(res, 'Permission add_member:body is required, but not present.');
    }

    const user = await User.findByPk(req.body.user_id);
    if (!user) {
        return errors.makeNotFoundError(res, 'User is not found');
    }

    const membership = await BodyMembership.create({
        body_id: req.currentBody.id,
        user_id: user.id
    });

    return res.json({
        success: true,
        data: membership
    });
};

exports.updateMembership = async (req, res) => {
    if (!req.permissions.hasPermission('update_member:body')) {
        return errors.makeForbiddenError(res, 'Permission update_member:body is required, but not present.');
    }

    await req.currentBodyMembership.update({ comment: req.body.comment });
    return res.json({
        success: true,
        data: req.currentBodyMembership
    });
};

exports.deleteMembership = async (req, res) => {
    if (!req.permissions.hasPermission('delete_member:body')) {
        return errors.makeForbiddenError(res, 'Permission delete_member:body is required, but not present.');
    }

    await req.currentBodyMembership.destroy();

    return res.json({
        success: true,
        message: 'Membership is deleted.'
    });
};

exports.deleteOwnMembership = async (req, res) => {
    const bodyMembership = await BodyMembership.findOne({
        where: { user_id: req.user.id, body_id: req.currentBody.id }
    });

    if (!bodyMembership) {
        return errors.makeNotFoundError(res, 'You are not a member.');
    }

    await bodyMembership.destroy();

    return res.json({
        success: true,
        message: 'Membership is deleted.'
    });
};
