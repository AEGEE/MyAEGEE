const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');

const AntennaCriterion = sequelize.define('antennaCriterion', {
    agora_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notNull: { msg: 'Agora should be set.' },
            notEmpty: { msg: 'Agora should be set.' },
            ...helpers.idValidators('Agora ID')
        }
    },
    body_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notNull: { msg: 'Body should be set.' },
            notEmpty: { msg: 'Body should be set.' },
            ...helpers.idValidators('Body ID')
        }
    },
    antenna_criterion: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.ENUM('communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report'),
        validate: {
            notNull: { msg: 'Antenna criterion should be set.' },
            isOneOf: helpers.oneOf(['communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report'], 'Antenna criterion must be one of these: "communication", "board election", "members list", "membership fee", "events", "agora attendance", "development plan", "fulfilment report".')
        }
    },
    value: {
        allowNull: true,
        type: Sequelize.ENUM('true', 'false', 'exception'),
        validate: {
            isOneOf: helpers.oneOf(['true', 'false', 'exception'], 'Value must be one of these: "true", "false", "exception", or null.')
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
