const { User } = require('../models');
const { Sequelize } = require('../lib/sequelize');
const errors = require('../lib/errors');

module.exports.listAllUsers = async (req, res) => {

};

module.exports.getUser = async (req, res) => {
    // TODO: check permissions
    return res.json({
        success: true,
        data: req.currentUser
    });
};
