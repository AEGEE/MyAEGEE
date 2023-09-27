const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const config = require('../config');

const MailChange = sequelize.define('mail_change', {
    user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    value: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
            notNull: { msg: 'Value should be set.' },
            notEmpty: { msg: 'Value should be set.' },
        },
        unique: true
    },
    new_email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'New email should be set.' },
            notNull: { msg: 'New email should be set.' },
            isEmail: { msg: 'New email should be valid.' },
            isValid(value) {
                if (constants.RESTRICTED_EMAILS.some((email) => value.includes(email))) {
                    throw new Error('Email can not be in one of the following domains: ' + constants.RESTRICTED_EMAILS.join(', ').trim() + '.');
                }
            }
        },
        unique: true
    },
    expires_at: {
        type: Sequelize.DATE,
        allowNull: false
    }
}, {
    underscored: true,
    tableName: 'mail_changes',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

MailChange.beforeValidate(async (mailChange) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof mailChange.new_email === 'string') mailChange.new_email = mailChange.new_email.toLowerCase().trim();
});

MailChange.createForUser = async function createForUser(user, newEmail, transaction) {
    const value = await helpers.getRandomBytes(constants.TOKEN_LENGTH.ACCESS_TOKEN);
    const expiresAt = moment().add(config.ttl.mail_change, 'seconds');

    return MailChange.create({
        user_id: user.id,
        value,
        expires_at: expiresAt,
        new_email: newEmail
    }, { transaction });
};

module.exports = MailChange;
