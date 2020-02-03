const { Sequelize, sequelize } = require('../lib/sequelize');

const Permission = sequelize.define('permission', {
    scope: {
        type: Sequelize.ENUM('global', 'global'),
        allowNull: false,
        defaultValue: '',
        validate: {
            isIn: {
                args: [['global', 'local']],
                msg: 'Permission scope should be one of these: "global", "local".'
            }
        }
    },
    action: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Action should be set.' },
        },
    },
    object: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Object should be set.' },
        },
    },
    combined: {
        type: Sequelize.STRING,
        allowNull: true
    },
    description: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Description should be set.' },
        },
    },
    filters: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
    }
}, {
    underscored: true,
    tableName: 'permissions',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

Permission.afterValidate((permission) => {
    permission.combined = [
        permission.scope,
        permission.action,
        permission.object
    ].join(':');
});

module.exports = Permission;
