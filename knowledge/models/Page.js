const { Sequelize, sequelize } = require('../lib/sequelize');

const Page = sequelize.define('page', {
    name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Page name should be set.' }
        },
    },
    category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Category ID should be set.' },
        },
    },
    content_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Type should be set.' },
        },
    },
    content: {
        type: Sequelize.TEXT
    }
}, {
    underscored: true,
    tableName: 'pages',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Page;
