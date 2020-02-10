const { Sequelize, sequelize } = require('../lib/sequelize');

const BodyMembership = sequelize.define('body_membership', {
    comment: {
        type: Sequelize.TEXT,
        allowNull: true
    }
}, {
    underscored: true,
    tableName: 'body_memberships',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = BodyMembership;
