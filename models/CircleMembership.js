const { Sequelize, sequelize } = require('../lib/sequelize');

const CircleMembership = sequelize.define('circle_membership', {
    position: {
        type: Sequelize.TEXT,
        allowNull: true
    }
}, {
    underscored: true,
    tableName: 'circle_memberships',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = CircleMembership;
