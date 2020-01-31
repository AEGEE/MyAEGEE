const crypto = require('crypto');
const util = require('util');

const { Sequelize, sequelize } = require('../lib/sequelize');

const randomBytes = util.promisify(crypto.randomBytes);

const RefreshToken = sequelize.define('refresh_token', {
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
    }
}, {
    underscored: true,
    tableName: 'refresh_tokens',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

RefreshToken.createForUser = async function createForUser(userId) {
    const value = (await randomBytes(256)).toString('hex');
    return RefreshToken.create({
        user_id: userId,
        value
    });
};

module.exports = RefreshToken;
