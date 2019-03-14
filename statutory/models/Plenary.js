const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Plenary = sequelize.define('plenary', {
    name: {
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Plenary name should be set.' },
        },
    },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Plenary start date should be set.' },
            isDate: { msg: 'Plenary start date should be valid.' }
        }
    },
    ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Plenary end date should be set.' },
            isDate: { msg: 'Plenary end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Plenary cannot start after or at the same time it ends.');
                }
            }
        }
    }
}, { underscored: true, tableName: 'plenaries' });

module.exports = Plenary;
