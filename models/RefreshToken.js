const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

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
    const value = await helpers.getRandomBytes(constants.TOKEN_LENGTH.REFRESH_TOKEN);
    return RefreshToken.create({
        user_id: userId,
        value
    });
};

module.exports = RefreshToken;
