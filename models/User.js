const bcrypt = require('bcrypt');

const { Sequelize, sequelize } = require('../lib/sequelize');
const config = require('../config');

const User = sequelize.define('user', {
    username: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Username should be set.' },
            isValid(value) {
                if (!/^[a-zA-Z0-9._-]*$/.test(value)) {
                    throw new Error('Username should only contain letters, numbers, dots, underscores and dashes.');
                }
            }
        },
        unique: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Email should be set.' },
            isEmail: { msg: 'Email should be valid.' }
        },
        unique: true
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Password should be set.' },
        },
        unique: true
    },
    mail_confirmed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
    },
    active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    superadmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    first_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'First name should be set.' },
            isValid(value) {
                if (!new RegExp('^[\\p{L} -]*$', 'u').test(value)) {
                    throw new Error('First name should only contain letters, spaces and dashes.');
                }
            }
        }
    },
    last_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Last name should be set.' },
            isValid(value) {
                if (!new RegExp('^[\\p{L} -]*$', 'u').test(value)) {
                    throw new Error('Last name should only contain letters, spaces and dashes.');
                }
            }
        }
    },
    date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
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
    if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, config.salt_rounds);
    }

    // skipping these fields if they are unset, will catch it later.
    if (typeof user.email === 'string') user.email = user.email.toLowerCase().trim();
    if (typeof user.username === 'string') user.username = user.username.toLowerCase().trim();
});

User.afterValidate(async (user) => {
    if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, config.salt_rounds);
    }
});

User.prototype.checkPassword = async function checkPassword(password) {
    return bcrypt.compare(password, this.password);
};

User.prototype.notValidFields = function notValidFields() {
    const missingFields = [];
    for (const field of ['date_of_birth', 'gender']) {
        if (!this[field]) {
            missingFields.push(field);
        }
    }

    return { missingFields };
};

module.exports = User;
