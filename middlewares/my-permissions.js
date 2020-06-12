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
    if (!req.body.action || !req.body.object) {
        return errors.makeBadRequestError(res, 'Action or object is not specified.');
    }

    const permission = await Permission.findOne({
        where: {
            scope: 'local',
            action: req.body.action,
            object: req.body.object
        }
    });

    if (!permission) {
        return errors.makeNotFoundError(res, 'Permission is not found.');
    }

    const circles = await req.permissions.fetchPermissionCircles(permission);
    const circleIds = circles.map((circle) => circle.id);

    const result = await Circle.findAndCountAll({
        where: {
            '$circle_memberships.user_id$': req.user.id,
            '$circle_memberships.circle_id$': { [Sequelize.Op.in]: circleIds },
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CIRCLE)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query),
        include: [CircleMembership]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};
