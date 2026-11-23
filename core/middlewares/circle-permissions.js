const { Permission, CirclePermission } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');

exports.addPermission = async (req, res) => {
    if (!req.permissions.hasPermission('global:put_permissions:circle')) {
        return errors.makeForbiddenError(res, 'Permission global:put_permissions:circle is required, but not present.');
    }

    const permissionId = helpers.parseId(req.body.permission_id);
    if (!permissionId) {
        return errors.makeBadRequestError(res, 'The permission ID is not valid.');
    }

    const permission = await Permission.findByPk(permissionId);
    if (!permission) {
        return errors.makeNotFoundError(res, 'The permission is not found.');
    }

    await CirclePermission.create({
        circle_id: req.currentCircle.id,
        permission_id: permission.id
    });

    return res.json({
        success: true,
        message: 'Permission was added to circle.'
    });
};

exports.deletePermission = async (req, res) => {
    if (!req.permissions.hasPermission('global:put_permissions:circle')) {
        return errors.makeForbiddenError(res, 'Permission global:put_permissions:circle is required, but not present.');
    }

    const permissionId = helpers.parseId(req.params.permission_id);
    if (!permissionId) {
        return errors.makeBadRequestError(res, 'The permission ID is not valid.');
    }

    const circlePermission = await CirclePermission.findOne({
        where: {
            circle_id: req.currentCircle.id,
            permission_id: permissionId
        }
    });

    if (!circlePermission) {
        return errors.makeNotFoundError(res, 'The permission does not belong to this circle.');
    }

    await circlePermission.destroy();

    return res.json({
        success: true,
        message: 'Permission was deleted from circle.'
    });
};
