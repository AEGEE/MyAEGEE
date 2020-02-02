const { User } = require('../models');

exports.listAllUsers = async (req, res) => {
    const users = await User.findAll({});

    return res.json({
        success: true,
        data: users
    });
};

exports.getUser = async (req, res) => {
    // TODO: check permissions
    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.updateUser = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    await req.currentUser.update(req.body);
    return res.json({
        success: true,
        data: req.currentUser
    });
};

exports.deleteUser = async (req, res) => {
    // TODO: check permissions
    await req.currentUser.destroy();
    return res.json({
        success: true,
        message: 'User is deleted.'
    });
};

exports.setUserActive = async (req, res) => {
    // TODO: check permissions
    await req.currentUser.update({ active: req.body.active });
    return res.json({
        success: true,
        message: req.currentUser
    });
};
