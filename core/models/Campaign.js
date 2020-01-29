const { Sequelize, sequelize } = require('../lib/sequelize');
const config = require('../config');

const Campaign = sequelize.define('campaign', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Name should be set.' },
        }
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Name should be set.' },
        },
        unique: true
    },
    active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    description_short: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Description should be set.' },
        }
    },
    description_long: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Description should be set.' },
        }
    },
    activate_user: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
}, {
    underscored: true,
    tableName: 'campaigns',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Campaign;
