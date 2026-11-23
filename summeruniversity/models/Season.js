const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const {
    isInteger, isText, dateSetter, isDate, areDates
} = require('../lib/validators');

// Every STRING column is a varchar(255): longer values are a validation error, not a database error.
const STRING_LENGTH = {
    len: { args: [0, 255], msg: 'This text should be at most 255 characters long.' }
};

const Season = sequelize.define(
    'season',
    {
        year: {
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: true,
            validate: {
                isInteger: isInteger('Season year should be a valid year.'),
                min: { args: [2000], msg: 'Season year should be a valid year.' }
            }
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: '',
            validate: {
                isText,
                ...STRING_LENGTH,
                notEmpty: { msg: 'Season name should be set.' }
            }
        },
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        event_submission_deadline: {
            type: Sequelize.DATE,
            set: dateSetter('event_submission_deadline'),
            allowNull: true,
            validate: {
                isDate: isDate('Event submission deadline should be valid.')
            }
        },
        application_period_starts: {
            type: Sequelize.DATE,
            set: dateSetter('application_period_starts'),
            allowNull: true,
            validate: {
                isDate: isDate('Application period start should be valid.')
            }
        },
        application_period_ends: {
            type: Sequelize.DATE,
            set: dateSetter('application_period_ends'),
            allowNull: true,
            validate: {
                isDate: isDate('Application period end should be valid.')
            }
        }
    },
    {
        underscored: true,
        tableName: 'seasons',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        validate: {
            // A model validator, so it also runs when only one of the two dates is updated.
            applicationPeriodOrder() {
                if (!areDates(this.application_period_starts, this.application_period_ends)) {
                    return;
                }

                if (moment(this.application_period_ends).isSameOrBefore(this.application_period_starts)) {
                    throw new Error('Application period cannot end before or at the same time it starts.');
                }
            }
        }
    }
);

module.exports = Season;
