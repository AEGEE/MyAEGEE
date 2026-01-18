const { Sequelize, sequelize } = require('../lib/sequelize');

const Question = sequelize.define('question', {
    question_line_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Question line should be set.' },
            isInt: { msg: 'Question line ID should be a number.' }
        }
    },
    application_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Application should be set.' },
            isInt: { msg: 'Application ID should be a number.' }
        },
    },
    text: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Question text should be set.' },
        }
    }
}, {
    underscored: true,
    tableName: 'questions',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Question;
