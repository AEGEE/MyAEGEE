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
    chapter_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Chapter ID should be set.' },
        },
    },
    content_type: {
        type: Sequelize.STRING
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
