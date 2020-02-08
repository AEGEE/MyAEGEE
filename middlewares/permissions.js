const { Permission } = require('../models');

exports.listAllPermissions = async (req, res) => {
    const permissions = await Permission.findAll({});

    return res.json({
        success: true,
        data: permissions
    });
};

exports.getPermission = async (req, res) => {
    // TODO: check permissions
    return res.json({
        success: true,
        data: req.currentPermission
    });
};

exports.createPermission = async (req, res) => {
    // TODO: check permissions
    const permission = await Permission.create(req.body);
    return res.json({
        success: true,
        data: permission
    });
};

exports.updatePermission = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    await req.currentPermission.update(req.body);
    return res.json({
        success: true,
        data: req.currentPermission
    });
};

exports.deletePermission = async (req, res) => {
    // TODO: check permissions
    await req.currentPermission.destroy();
    return res.json({
        success: true,
        message: 'Permission is deleted.'
    });
};
