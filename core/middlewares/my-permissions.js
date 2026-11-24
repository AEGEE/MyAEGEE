const {
    Permission,
    CircleMembership,
    Circle
} = require('../models');
const { Sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');
const constants = require('../lib/constants');

exports.getMyPermissions = async (req, res) => {
    return res.json({
        success: true,
        data: req.permissions.permissions
    });
};

exports.getMyCirclesWithPermission = async (req, res) => {
    const action = helpers.stringOrEmpty(req.body.action);
    const object = helpers.stringOrEmpty(req.body.object);
    if (!action || !object) {
        return errors.makeBadRequestError(res, 'Action or object is not specified.');
    }

    const permission = await Permission.findOne({
        where: { scope: 'local', action, object }
    });

    if (!permission) {
        return errors.makeNotFoundError(res, 'Permission is not found.');
    }

    const circles = await req.permissions.fetchPermissionCircles(permission);
    const circleIds = circles.map((circle) => circle.id);

    // The member's own memberships in those circles are looked up first, so the list itself
    // can be counted and cut into pages by circle.
    const memberships = await CircleMembership.findAll({
        where: { user_id: req.user.id, circle_id: { [Sequelize.Op.in]: circleIds } },
        attributes: ['circle_id']
    });

    const result = await Circle.findAndCountAll({
        where: {
            id: { [Sequelize.Op.in]: memberships.map((membership) => membership.circle_id) },
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CIRCLE)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, Circle),
        include: [{
            model: CircleMembership,
            where: { user_id: req.user.id },
            required: false,
            separate: true
        }]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};
