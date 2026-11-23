const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');

const MailComponent = sequelize.define('mailComponent', {
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
    mail_component: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.ENUM('introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'),
        validate: {
            notNull: { msg: 'Mail component should be set.' },
            isOneOf: helpers.oneOf(['introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'], 'Message component must be one of these: "introduction", "communication", "board election", "members list", "membership fee", "events", "agora attendance", "development plan", "fulfilment report", "closing".')
        }
    },
    text: {
        allowNull: false,
        type: Sequelize.TEXT,
        validate: {
            notNull: { msg: 'Text should be set.' }
        }
    }
}, {
    underscored: true,
    tableName: 'mailComponent',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    primaryKey: ['agora_id', 'mail_component']
});

module.exports = MailComponent;
