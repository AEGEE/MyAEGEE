const { Sequelize, sequelize } = require('../lib/sequelize');

const JoinRequest = sequelize.define('join_request', {
    id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
    },
    motivation: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    status: {
        type: Sequelize.ENUM('pending', 'approved'),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
            isIn: {
                args: [['pending', 'approved']],
                msg: 'Status should be one of these: "pending", "approved".'
            }
        }
    },
}, {
    underscored: true,
    tableName: 'join_requests',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

JoinRequest.beforeValidate(async (request) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof request.motivation === 'string') request.motivation = request.motivation.trim();
});

module.exports = JoinRequest;
