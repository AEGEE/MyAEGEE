const { Sequelize, sequelize } = require('../lib/sequelize');

const Permission = sequelize.define('permission', {
    scope: {
        type: Sequelize.ENUM('global', 'global'),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Scope should be set.' },
            isIn: {
                args: [['global', 'local', 'join_request']],
                msg: 'Permission scope should be one of these: "global", "local", "join_request.'
            }
        },
        unique: { args: true, msg: 'There\'s already a permission with such scope, action and object.' }
    },
    action: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Action should be set.' },
            notNull: { msg: 'Action should be set.' }
        },
        unique: { args: true, msg: 'There\'s already a permission with such scope, action and object.' }
    },
    object: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Object should be set.' },
            notNull: { msg: 'Object should be set.' }
        },
        unique: { args: true, msg: 'There\'s already a permission with such scope, action and object.' }
    },
    combined: {
        type: Sequelize.STRING,
        allowNull: true
    },
    description: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Description should be set.' },
            notNull: { msg: 'Description should be set.' }
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

Permission.beforeValidate(async (permission) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof permission.action === 'string') permission.action = permission.action.toLowerCase().trim();
    if (typeof permission.object === 'string') permission.object = permission.object.toLowerCase().trim();
    if (typeof permission.description === 'string') permission.description = permission.description.trim();
});

Permission.afterValidate((permission, options) => {
    permission.combined = [
        permission.scope,
        permission.action,
        permission.object
    ].join(':');
    options.fields.push('combined');
});

module.exports = Permission;
