const crypto = require('crypto');
const util = require('util');
const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const config = require('../config');

const randomBytes = util.promisify(crypto.randomBytes);

const AccessToken = sequelize.define('access_token', {
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
    tableName: 'access_tokens',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

AccessToken.createForUser = async function createForUser(userId) {
    const value = (await randomBytes(64)).toString('hex');
    const expiresAt = moment().add(config.ttl.access_token, 'seconds');

    return AccessToken.create({
        user_id: userId,
        value,
        expires_at: expiresAt
    });
};

module.exports = AccessToken;
