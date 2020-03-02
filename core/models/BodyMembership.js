const { Sequelize, sequelize } = require('../lib/sequelize');
const logger = require('../lib/logger');
const Body = require('./Body');
const Circle = require('./Circle');
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
BodyMembership.afterCreate(async (membership) => {
    const body = await Body.findByPk(membership.body_id);
    if (!body.shadow_circle_id) {
        logger.info('No shadow circle specified for body, not adding person to circle.');
        return;
    }

    logger.info(`Adding person ${membership.id} to shadow circle ${body.shadow_circle_id} of body ${body.id}`);
    await CircleMembership.create({
        circle_id: body.shadow_circle_id,
        user_id: membership.user_id
    });
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

module.exports = BodyMembership;
