const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

const config = require('../config');

const MailConfirmation = sequelize.define('mail_confirmation', {
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
        }
    },
    expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Expires should be set.' },
        }
    },
    is_expired: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isAfter(this.expires_at);
        }
    },
}, {
    underscored: true,
    tableName: 'mail_confirmations',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

MailConfirmation.createForUser = async function createForUser(userId, transaction) {
    const value = await helpers.getRandomBytes(constants.TOKEN_LENGTH.MAIL_CONFIRMATION);
    return MailConfirmation.create({
        user_id: userId,
        expires_at: moment().add(config.ttl.mail_confirmation, 'seconds').toDate(),
        value
    }, { transaction });
};

module.exports = MailConfirmation;
