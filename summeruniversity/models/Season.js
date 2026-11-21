const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Season = sequelize.define(
    'season',
    {
        year: {
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: true,
            validate: {
                isInt: { msg: 'Season year should be a valid year.' },
                min: { args: [2000], msg: 'Season year should be a valid year.' }
            }
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: '',
            validate: {
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
            allowNull: true,
            validate: {
                isDate: { msg: 'Event submission deadline should be valid.' }
            }
        },
        application_period_starts: {
            type: Sequelize.DATE,
            allowNull: true,
            validate: {
                isDate: { msg: 'Application period start should be valid.' }
            }
        },
        application_period_ends: {
            type: Sequelize.DATE,
            allowNull: true,
            validate: {
                isDate: { msg: 'Application period end should be valid.' }
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
                if (!this.application_period_starts || !this.application_period_ends) {
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
