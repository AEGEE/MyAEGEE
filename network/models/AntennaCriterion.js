const { Sequelize, sequelize } = require('../lib/sequelize');

const AntennaCriterion = sequelize.define('antennaCriterion', {
    agora_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Agora should be set.' },
            isInt: { msg: 'Agora ID should be a number.' }
        }
    },
    body_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Body should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        }
    },
    antenna_criterion: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.ENUM('communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report'),
        validate: {
            isIn: {
                args: [['communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report']],
                msg: 'Antenna criterion must be one of these: "communication", "board election", "members list", "membership fee", "events", "agora attendance", "development plan", "fulfilment report".'
            }
        }
    },
    value: {
        allowNull: true,
        type: Sequelize.ENUM('true', 'false', 'exception'),
        validate: {
            isIn: {
                args: [['true', 'false', 'exception']],
                msg: 'Value must be one of these: "true", "false", "exception", or null.'
            }
        }
    },
    comment: {
        allowNull: true,
        type: Sequelize.TEXT
    }
}, {
    underscored: true,
    tableName: 'antennaCriteria',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    primaryKey: ['agora_id', 'body_id', 'antenna_criterion']
});

module.exports = AntennaCriterion;
