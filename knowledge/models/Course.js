const { Sequelize, sequelize } = require('../lib/sequelize');

const Course = sequelize.define('course', {
    name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Course name should be set.' }
        },
    },
    description: {
        type: Sequelize.TEXT
    }
}, {
    underscored: true,
    tableName: 'courses',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Course;
