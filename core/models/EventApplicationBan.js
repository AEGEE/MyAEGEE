const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const EventApplicationBan = sequelize.define('event_application_ban', {
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'User should be set.' },
            isInt: { msg: 'User ID should be a number.' }
        }
    },
    banned_by_user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Banning user should be set.' },
            isInt: { msg: 'Banning user ID should be a number.' }
        }
    },
    ban_until: {
        allowNull: false,
        type: Sequelize.DATE,
        validate: {
            notEmpty: { msg: 'Ban end date should be set.' },
            isDate: { msg: 'Ban end date should be valid.' },
            isFuture(value) {
                if (moment(value).isSameOrBefore(moment())) {
                    throw new Error('Ban end date should be in the future.');
                }
            }
        }
    },
    lifted_by_user_id: {
        allowNull: true,
        type: Sequelize.INTEGER,
        validate: {
            isInt: { msg: 'Lifting user ID should be a number.' }
        }
    },
    lifted_at: {
        allowNull: true,
        type: Sequelize.DATE,
        validate: {
            isDate: { msg: 'Lift date should be valid.' }
        }
    }
}, {
    underscored: true,
    tableName: 'event_application_bans',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

EventApplicationBan.findActiveForUser = (userId) => EventApplicationBan.findOne({
    where: {
        user_id: userId,
        lifted_at: null,
        ban_until: { [Sequelize.Op.gt]: new Date() }
    },
    order: [['created_at', 'DESC']]
});

module.exports = EventApplicationBan;
