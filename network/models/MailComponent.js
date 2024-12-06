const { Sequelize, sequelize } = require('../lib/sequelize');

const MailComponent = sequelize.define('mailComponent', {
    agora_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Agora should be set.' },
            isInt: { msg: 'Agora ID should be a number.' }
        }
    },
    mail_component: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.ENUM('introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'),
        validate: {
            isIn: {
                args: [['introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing']],
                msg: 'Message component must be one of these: "introduction", "communication", "board election", "members list", "membership fee", "events", "agora attendance", "development plan", "fulfilment report", "closing".'
            }
        }
    },
    text: {
        allowNull: false,
        type: Sequelize.TEXT
    }
}, {
    underscored: true,
    tableName: 'mailComponent',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    primaryKey: ['agora_id', 'mail_component']
});

module.exports = MailComponent;
