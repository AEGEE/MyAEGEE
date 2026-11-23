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
                if (helpers.isRestrictedEmail(value)) {
                    throw new Error('Email can not be in one of the following domains: ' + constants.RESTRICTED_EMAILS.join(', ').trim() + '.');
                }
            }
        },
        unique: true
    },
    expires_at: {
        type: Sequelize.DATE,
        allowNull: false
    },
    // The token for the current address. Only set if that address has to confirm the change as well.
    old_value: {
        type: Sequelize.TEXT,
        allowNull: true,
        unique: true
    },
    // The login address the change was requested for.
    old_email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Old email should be set.' },
            notNull: { msg: 'Old email should be set.' }
        }
    },
    new_confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
    },
    old_confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
    },
    // Who requested the change, if not the member themselves.
    requested_by: {
        type: Sequelize.INTEGER,
        allowNull: true
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

// By default only the new address has to confirm the change. With `needsOldConfirmation`,
// the current address gets a token of its own and has to confirm it as well.
MailChange.createForUser = async function createForUser(user, newEmail, options = {}) {
    const value = await helpers.getRandomBytes(constants.TOKEN_LENGTH.MAIL_CHANGE);
    const oldValue = options.needsOldConfirmation
        ? await helpers.getRandomBytes(constants.TOKEN_LENGTH.MAIL_CHANGE)
        : null;
    const expiresAt = moment().add(config.ttl.mail_change, 'seconds');

    return MailChange.create({
        user_id: user.id,
        value,
        old_value: oldValue,
        expires_at: expiresAt,
        new_email: newEmail,
        old_email: user.email,
        requested_by: options.requestedBy || null
    }, { transaction: options.transaction });
};

// Returns the address which still has to confirm ('new_email' or 'old_email'),
// or null if the change can take effect.
MailChange.prototype.waitingFor = function waitingFor() {
    if (!this.new_confirmed_at) {
        return 'new_email';
    }

    if (this.old_value && !this.old_confirmed_at) {
        return 'old_email';
    }

    return null;
};

module.exports = MailChange;
