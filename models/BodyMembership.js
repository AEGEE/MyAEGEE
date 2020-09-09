const { Sequelize, sequelize } = require('../lib/sequelize');
const logger = require('../lib/logger');
const Body = require('./Body');
const User = require('./User');
const Circle = require('./Circle');
const JoinRequest = require('./JoinRequest');
const CircleMembership = require('./CircleMembership');

const BodyMembership = sequelize.define('body_membership', {
    id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
    },
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

// Adding a person to a shadow circle after joining the body.
BodyMembership.afterCreate(async (membership, options) => {
    const body = await Body.findByPk(membership.body_id);
    if (!body.shadow_circle_id) {
        logger.info('No shadow circle specified for body, not adding person to circle.');
        return;
    }

    logger.info({
        membership_id: membership.id,
        shadow_circle_id: body.shadow_circle_id,
        body_id: body.id
    }, 'Adding person to shadow circle of body');
    await CircleMembership.create({
        circle_id: body.shadow_circle_id,
        user_id: membership.user_id
    }, { transaction: options.transaction });
});

// Deleting all the circle memberships after leaving the body.
BodyMembership.afterDestroy(async (membership) => {
    const circles = await Circle.findAll({ where: { body_id: membership.body_id } });
    const ids = circles.map((circle) => circle.id);

    await CircleMembership.destroy({
        where: {
            user_id: membership.user_id,
            circle_id: { [Sequelize.Op.in]: ids }
        }
    });
});

// Deleting all the join requests after leaving the body.
BodyMembership.afterDestroy(async (membership) => {
    await JoinRequest.destroy({
        where: {
            user_id: membership.user_id,
            body_id: membership.body_id
        }
    });
});

// Unsetting primary body for user if needed.
BodyMembership.afterDestroy(async (membership) => {
    const user = await User.findByPk(membership.user_id);

    if (user.primary_body_id === membership.body_id) {
        await user.update({ primary_body_id: null });
    }
});


module.exports = BodyMembership;
