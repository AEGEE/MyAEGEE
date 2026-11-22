const { Sequelize, sequelize } = require('../lib/sequelize');
const constants = require('../lib/constants');

const ResourceCategory = sequelize.define('resource_category', {
    name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Name should be set.' },
            notNull: { msg: 'Name should be set.' },
            len: { args: [1, 100], msg: 'Name should be at most 100 characters long.' }
        }
    },
    theme: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notNull: { msg: 'Theme should be set.' },
            isIn: {
                args: [constants.RESOURCE_THEMES],
                msg: 'Theme should be one of: ' + constants.RESOURCE_THEMES.join(', ') + '.'
            }
        }
    },
    position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    underscored: true,
    tableName: 'resource_categories',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

ResourceCategory.beforeValidate((category) => {
    if (typeof category.name === 'string') category.name = category.name.trim();
});

module.exports = ResourceCategory;
