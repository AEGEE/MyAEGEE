const _ = require('lodash');

const helpers = require('../lib/helpers');
const {
    Circle,
    CircleMembership,
    CirclePermission,
    Permission,
} = require('../models');
const { Sequelize } = require('../lib/sequelize');

exports.getMyGlobalPermissions = async (req, res, next) => {
    // Fetching permissions.
    // 1) get the list of the circles user's in.
    const directCircleMemberships = await CircleMembership.findAll({
        where: { user_id: req.user.id }
    });

    // 2) get the list of all circles with only id and parent_circle_id
    // and converting it to a map to not look over the whole
    // array each time.
    req.allCircles = await Circle.findAll({ fields: ['id', 'parent_circle_id'] });
    req.allCirclesMap = _.keyBy(req.allCircles, 'id');

    // 3) fetch all the permissions
    const indirectCirclesArray = helpers.traverseIndirectCircles(req.allCirclesMap, directCircleMemberships.map((membership) => membership.circle_id));
    req.permissions = await Permission.findAll({
        where: {
            '$circle_permissions.circle_id$': { [Sequelize.Op.in]: indirectCirclesArray },
            scope: 'global'
        },
        include: [CirclePermission]
    });

    req.permissionsMap = _(req.permissions)
        .map((elt) => [elt, 1])
        .unzipWith()
        .value();

    return next();
};
