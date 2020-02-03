const { sequelize } = require('../lib/sequelize');

const CirclePermission = sequelize.define('circle_permission', {}, {
    underscored: true,
    tableName: 'circle_permissions',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = CirclePermission;
