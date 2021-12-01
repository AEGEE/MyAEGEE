const bcrypt = require('bcrypt');
const moment = require('moment');

const constants = require('../lib/constants');
const { Sequelize, sequelize } = require('../lib/sequelize');
const config = require('../config');

const NAME_REGEX = /^[\p{L}. -']*$/u;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]*$/;

const User = sequelize.define('user', {
    username: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Username should be set.' },
            notNull: { msg: 'Username should be set.' },
            isValid(value) {
                if (!USERNAME_REGEX.test(value)) {
                    throw new Error('Username should only contain letters, numbers, dots, underscores and dashes.');
                }
                if (value.match(/^[0-9._-]+$/)) {
                    throw new Error('Username should have at least 1 letter.');
                }
            }
        },
        unique: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Email should be set.' },
            notNull: { msg: 'Email should be set.' },
            isEmail: { msg: 'Email should be valid.' },
            isValid(value) {
                if (constants.RESTRICTED_EMAILS.some((email) => value.includes(email))) {
                    throw new Error('Email can not be in one of the following domains: ' + constants.RESTRICTED_EMAILS.join(', ').trim() + '.');
                }
            }
        },
        unique: true
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notNull: { msg: 'Password should be set.' },
            notEmpty: { msg: 'Password should be set.' },
            len: { args: [8], msg: 'Password should be at least 8 characters long.' }
        }
    },
    mail_confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
    },
    active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        validate: {
            isBoolean: { msg: 'Active should be valid.' }
        }
    },
    superadmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    privacy_consent: {
        type: Sequelize.DATE,
        allowNull: true
    },
    first_name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'First name should be set.' },
            notNull: { msg: 'First name should be set.' },
            isValid(value) {
                if (!NAME_REGEX.test(value)) {
                    throw new Error(`First name should only contain letters, spaces and dashes, got "${value}".`);
                }
            }
        }
    },
    last_name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Last name should be set.' },
            notNull: { msg: 'Last name should be set.' },
            isValid(value) {
                if (!NAME_REGEX.test(value)) {
                    throw new Error(`Last name should only contain letters, spaces and dashes, got "${value}".`);
                }
            }
        }
    },
    date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        validate: {
            isPast(value) {
                if (!value) {
                    return;
                }

                if (moment().isSameOrBefore(value)) {
                    throw new Error('Birthday should be in the past.');
                }
            }
        }
    },
    gender: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: ''
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: ''
    },
    address: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: ''
    },
    about_me: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: ''
    },
    primary_email: {
        type: Sequelize.ENUM('personal', 'gsuite'),
        allowNull: false,
        defaultValue: 'personal'
    },
    notification_email: {
        type: Sequelize.VIRTUAL,
        get() {
            if (this.primary_email === 'gsuite') {
                return this.gsuite_id;
            }
            return this.email;
        }
    },
    last_logged_in: {
        type: Sequelize.DATE,
        allowNull: true
    },
    last_active: {
        type: Sequelize.DATE,
        allowNull: true
    },
    gsuite_id: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            isEmail: { msg: 'GSuite ID should be a valid email.' }
        },
        unique: true
    }
}, {
    underscored: true,
    tableName: 'users',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
        attributes: { exclude: ['password'] }
    },
    scopes: {
        withPassword: {
            attributes: { exclude: [] }
        },
        noExtraFields: {
            attributes: { exclude: ['id', 'superadmin', 'active', 'mail_confirmed_at'] }
        }
    }
});

User.beforeValidate(async (user) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof user.email === 'string') user.email = user.email.toLowerCase().trim();
    if (typeof user.username === 'string') user.username = user.username.toLowerCase().trim();
    if (typeof user.gsuite_id === 'string') user.gsuite_id = user.gsuite_id.toLowerCase().trim();

    if (typeof user.first_name === 'string') user.first_name = user.first_name.trim();
    if (typeof user.last_name === 'string') user.last_name = user.last_name.trim();
    if (typeof user.gender === 'string') user.gender = user.gender.trim();
    if (typeof user.phone === 'string') user.phone = user.phone.trim();
    if (typeof user.address === 'string') user.address = user.address.trim();
    if (typeof user.about_me === 'string') user.about_me = user.about_me.trim();

    if (typeof user.date_of_birth === 'string' && user.date_of_birth === '') user.date_of_birth = null;
});

async function encryptPassword(user) {
    if (user.changed('password')) {
        user.setDataValue('password', await bcrypt.hash(user.password, config.salt_rounds));
    }
}

User.beforeCreate(encryptPassword);
User.beforeUpdate(encryptPassword);

User.prototype.checkPassword = async function checkPassword(password) {
    return bcrypt.compare(password, this.password);
};

/* istanbul ignore next */
User.prototype.notValidFields = function notValidFields() {
    const errors = {};

    if (!this.gender) errors.gender = ['Gender should be set.'];
    if (!this.date_of_birth) errors.date_of_birth = ['Date of birth should be set.'];
    if (!this.phone) errors.phone = ['Phone should be set.'];
    if (!this.address) errors.address = ['Address should be set.'];

    return errors;
};

module.exports = User;
