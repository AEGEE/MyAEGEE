const { Sequelize, sequelize } = require('../lib/sequelize');

const VotesPerDelegate = sequelize.define('VotesPerDelegate', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event ID should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    application_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Application ID should be set.' },
            isInt: { msg: 'Application ID should be a number.' }
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body ID should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        },
    },
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'User ID should be set.' },
            isInt: { msg: 'User ID should be a number.' }
        },
    },
    type: {
        type: Sequelize.ENUM('on-event', 'off-event'),
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Type should be set.' },
            isIn: {
                args: [['on-event', 'off-event']],
                msg: 'Type should be one of these: "on-event", "off-event".'
            }
        }
    },
    votes: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Votes per antenna should be set.' },
            isNumeric: { msg: 'Votes per antenna should be valid.' },
            min: { args: [0], msg: 'Votes per antenna cannot be negative' }
        }
    }
}, { underscored: true, tableName: 'votes_per_delegate' });

module.exports = VotesPerDelegate;