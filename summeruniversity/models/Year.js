const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Year = sequelize.define('year', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Year name should be set.' },
        }
    },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Year start date should be set.' },
            isDate: { msg: 'Year start date should be valid.' }
            // TODO: after previous ends
            // TODO: fixed by CIA?
            // TODO: fixed to SUCT term?
        }
    },
    ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Year end date should be set.' },
            isDate: { msg: 'Year end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Year cannot start after or at the same time it ends.');
                }
            }
            // TODO: fixed by CIA?
            // TODO: fixed to SUCT term?

        }
    },
    opening_submission: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Submission start date should be set.' },
            isDate: { msg: 'Submission start date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Opening of submissions cannot be before the start of the year.');
                }
            }
        }
    },
    end_first_submission: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'First submission end date should be set.' },
            isDate: { msg: 'First submission end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.opening_submission)) {
                    throw new Error('Closing of first submissions cannot be before the opening of the submissions.');
                }
            }
        }
    },
    end_second_submission: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Second submission end date should be set.' },
            isDate: { msg: 'Second submission end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.end_first_submission)) {
                    throw new Error('Closing of second submissions cannot be before the closing of the first submissions.');
                }
            }
        }
    },
    publish_su: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'SU publishing date should be set.' },
            isDate: { msg: 'SU publishing date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.end_first_submission)) {
                    throw new Error('Publishing of the SUs cannot be before the closing of the first submissions.');
                }
            }
        }
    },
},
{
    underscored: true,
    tableName: 'years',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Year;
