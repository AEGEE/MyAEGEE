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


BodyMembership.beforeValidate(async (membership) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof membership.comment === 'string') membership.comment = membership.comment.trim();
});

module.exports = BodyMembership;
