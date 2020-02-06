const { User } = require('../models');
const constants = require('../lib/constants');

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
    await req.currentUser.update(req.body, { fields: constants.FIELDS_TO_UPDATE.USER });
    return res.json({
        success: true,
        data: req.currentUser
    });
};

// TODO: reimplement by not deleting, but anonymizing a user.
// exports.deleteUser = async (req, res) => {
//     // TODO: check permissions
//     await req.currentUser.destroy();
//     return res.json({
//         success: true,
//         data: 'User is deleted.'
//     });
// };

exports.setUserActive = async (req, res) => {
    // TODO: check permissions
    await req.currentUser.update({ active: req.body.active });
    return res.json({
        success: true,
        data: req.currentUser
    });
};
