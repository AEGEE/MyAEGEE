const { User } = require('../models');
const constants = require('../lib/constants');
const helpers = require('../lib/helpers');

exports.listAllUsers = async (req, res) => {
    // TODO: check permissions
    const result = await User.findAndCountAll({
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
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
    await req.currentUser.update(req.body, { fields: constants.FIELDS_TO_UPDATE.USER.UPDATE });
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
