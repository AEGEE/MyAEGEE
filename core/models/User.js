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
        }
    },
    last_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Last name should be set.' },
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
            attributes: { exclude: ['password', 'superadmin', 'active', 'mail_confirmed_at'] }
        }
    }
});

User.afterValidate(async (user) => {
    if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, config.salt_rounds);
    }
});

User.prototype.checkPassword = async function checkPassword(password) {
    return bcrypt.compare(password, this.password);
};

module.exports = User;
