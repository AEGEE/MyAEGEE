const { Sequelize, sequelize } = require('../lib/sequelize');

const Question = sequelize.define('question', {
    description: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Question description should be set.' }
        },
    },
    required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, { underscored: true });

module.exports = Question;