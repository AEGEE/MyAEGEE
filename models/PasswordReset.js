const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const config = require('../config');

const PasswordReset = sequelize.define('password_reset', {
    user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    value: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Value should be set.' },
        },
        unique: true
    },
    expires_at: {
        type: Sequelize.DATE,
        allowNull: false
    }
}, {
    underscored: true,
    tableName: 'password_resets',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

PasswordReset.createForUser = async function createForUser(userId) {
    const value = await helpers.getRandomBytes(constants.TOKEN_LENGTH.PASSWORD_RESET);
    const expiresAt = moment().add(config.ttl.password_reset, 'seconds');

    return PasswordReset.create({
        user_id: userId,
        value,
        expires_at: expiresAt
    });
};

module.exports = PasswordReset;
