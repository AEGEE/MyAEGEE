const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const config = require('../config');

const AccessToken = sequelize.define('access_token', {
    user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    value: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Value must be set.' },
        },
        unique: true
    },
    expires_at: {
        type: Sequelize.DATE,
        allowNull: false
    }
}, {
    underscored: true,
    tableName: 'access_tokens',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

AccessToken.createForUser = async function createForUser(userId) {
    const value = await helpers.getRandomBytes(constants.TOKEN_LENGTH.ACCESS_TOKEN);
    const expiresAt = moment().add(config.ttl.access_token, 'seconds');

    return AccessToken.create({
        user_id: userId,
        value,
        expires_at: expiresAt
    });
};

module.exports = AccessToken;
