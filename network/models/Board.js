const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Board = sequelize.define('board', {
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Body should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        }
    },
    elected_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        validate: {
            isPast(value) {
                if (moment().isSameOrBefore(value)) {
                    throw new Error('Election date should be in the past.');
                }
            },
            notEmpty: { msg: 'Election date should be set.' }
        }
    },
    start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Start date of the mandate should be set.' }
        }
    },
    end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        validate: {
            isFuture(value) {
                if (!value) {
                    return;
                }

                if (moment(value).isSameOrBefore(this.start_date)) {
                    throw new Error('End date of the mandate should be after start date.');
                }
            }
        }
    },
    name: {
        type: Sequelize.STRING,
        allowNull: true
    },
    president: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'President should be selected.' },
            isInt: { msg: 'President should be a number.' }
        }
    },
    secretary: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Secretary should be selected.' },
            isInt: { msg: 'Secretary should be a number.' }
        }
    },
    treasurer: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Treasurer should be selected.' },
            isInt: { msg: 'Treasurer should be a number.' }
        }
    },
    other_members: {
        type: Sequelize.JSONB,
        allowNull: true,
        validate: {
            isListOfPositions(value) {
                if (value === null || value === undefined) {
                    return;
                }

                const isPosition = (position) => position !== null
                    && typeof position === 'object'
                    && typeof position.function === 'string'
                    && position.function.trim() !== ''
                    && Number.isInteger(position.user_id)
                    && position.user_id > 0;

                if (!Array.isArray(value) || !value.every(isPosition)) {
                    throw new Error('Other members should be a list of positions, each with a function and a member.');
                }
            }
        }
    },
    message: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    new_board_email_sent_at: {
        type: Sequelize.DATE,
        allowNull: true
    },
    image_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
            isInt: { msg: 'Image ID should be a number.' }
        }
    }
}, {
    underscored: true,
    tableName: 'boards',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Board;
