const { Circle, } = require('../models');
const PermissionManager = require('../lib/permissions-manager');

exports.loadMyGlobalPermissions = async (req, res, next) => {
    if (!req.user) {
        return next();
    }

    const circles = await Circle.findAll({ fields: ['id', 'parent_circle_id'] });

    req.permissions = new PermissionManager({ user: req.user });
    req.permissions.addCircles(circles);

    await req.permissions.fetchUserPermissions();

    return next();
};

exports.getMyGlobalPermissions = async (req, res) => {
    return res.json({
        success: true,
        data: req.permissions.permissions
    });
};
