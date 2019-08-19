const { Sequelize, sequelize } = require('../lib/sequelize');

const QuestionLine = sequelize.define('question_line', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Question line name should be set.' },
        }
    },
    status: {
        type: Sequelize.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open',
        validate: {
            isIn: {
                args: [['open', 'closed']],
                msg: 'Position status can be one of these: "open", "closed".'
            }
        }
    }
}, {
    underscored: true,
    tableName: 'question_lines',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = QuestionLine;
