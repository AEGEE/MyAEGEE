const { Sequelize, sequelize } = require('../lib/sequelize');

const Circle = sequelize.define('circle', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Name should be set.' },
        }
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Description should be set.' },
        },
    }
}, {
    underscored: true,
    tableName: 'circles',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Circle;
