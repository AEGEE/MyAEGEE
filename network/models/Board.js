const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');

const Board = sequelize.define('board', {
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notNull: { msg: 'Body should be set.' },
            notEmpty: { msg: 'Body should be set.' },
            ...helpers.idValidators('Body ID')
        }
    },
    elected_date: {
        type: Sequelize.DATEONLY,
        set: helpers.dateSetter('elected_date'),
        allowNull: false,
        validate: {
            notNull: { msg: 'Election date should be set.' },
            isDateValue: helpers.dateValidator('Election date'),
            isPast(value) {
                // Compared by day: a board may be entered on its election day.
                if (moment(value, moment.ISO_8601).isAfter(moment(), 'day')) {
                    throw new Error('Election date should be today or in the past.');
                }
            },
            notEmpty: { msg: 'Election date should be set.' }
        }
    },
    start_date: {
        type: Sequelize.DATEONLY,
        set: helpers.dateSetter('start_date'),
        allowNull: false,
        validate: {
            notNull: { msg: 'Start date of the mandate should be set.' },
            notEmpty: { msg: 'Start date of the mandate should be set.' },
            isDateValue: helpers.dateValidator('Start date of the mandate')
        }
    },
    end_date: {
        type: Sequelize.DATEONLY,
        set: helpers.dateSetter('end_date'),
        allowNull: true,
        validate: {
            isDateValue: helpers.dateValidator('End date of the mandate'),
            isFuture(value) {
                if (!value) {
                    return;
                }

                if (moment(value, moment.ISO_8601).isSameOrBefore(this.start_date)) {
                    throw new Error('End date of the mandate should be after start date.');
                }
            }
        }
    },
    name: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            len: { args: [0, 255], msg: 'Name should be at most 255 characters.' }
        }
    },
    president: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notNull: { msg: 'President should be selected.' },
            notEmpty: { msg: 'President should be selected.' },
            // A member, whose ID starts at 1, as for the other positions.
            ...helpers.idValidators('President', 1)
        }
    },
    secretary: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notNull: { msg: 'Secretary should be selected.' },
            notEmpty: { msg: 'Secretary should be selected.' },
            // A member, whose ID starts at 1, as for the other positions.
            ...helpers.idValidators('Secretary', 1)
        }
    },
    treasurer: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notNull: { msg: 'Treasurer should be selected.' },
            notEmpty: { msg: 'Treasurer should be selected.' },
            // A member, whose ID starts at 1, as for the other positions.
            ...helpers.idValidators('Treasurer', 1)
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
                    && position.user_id > 0
                    && position.user_id <= helpers.MAX_ID;

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
            ...helpers.idValidators('Image ID')
        }
    }
}, {
    underscored: true,
    tableName: 'boards',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Board;
