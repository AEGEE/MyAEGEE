const { Sequelize, sequelize } = require('../lib/sequelize');

const Category = sequelize.define('category', {
    name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Category name should be set.' }
        },
    },
    course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Course ID should be set.' },
        },
    },
    description: {
        type: Sequelize.TEXT
    }
}, {
    underscored: true,
    tableName: 'categories',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Category;
