const crypto = require('crypto');
const moment = require('moment');
const util = require('util');

const { Sequelize, sequelize } = require('../lib/sequelize');
const config = require('../config');

const randomBytes = util.promisify(crypto.randomBytes);

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
    }
}, {
    underscored: true,
    tableName: 'mail_confirmations',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

MailConfirmation.createForUser = async function createForUser(userId) {
    const value = (await randomBytes(128)).toString('hex');
    return MailConfirmation.create({
        user_id: userId,
        expires_at: moment().add(config.ttl.mail_confirmation, 'seconds').toDate(),
        value
    });
};


module.exports = MailConfirmation;
