const { Permission } = require('../models');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');

exports.listAllPermissions = async (req, res) => {
    // TODO: add filtering
    const result = await Permission.findAndCountAll({
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

    // TODO: filter out fields that are changed in the other way
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
