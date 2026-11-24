const { Sequelize, sequelize } = require('../lib/sequelize');
const validators = require('../lib/validators');

const Campaign = sequelize.define('campaign', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Name should be set.' },
            notNull: { msg: 'Name should be set.' }
        }
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'URL should be set.' },
            notNull: { msg: 'URL should be set.' }
        },
        unique: true
    },
    active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        validate: {
            isBoolean: validators.isBoolean('Active should be true or false.')
        }
    },
    description_short: {
        type: Sequelize.TEXT,
        allowNull: true,
        validate: {
            notEmpty: { msg: 'Description should be set.' }
        }
    },
    description_long: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Description should be set.' },
            notNull: { msg: 'Description should be set.' }
        }
    },
    // The column does not take null.
    activate_user: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        validate: {
            notNull: { msg: 'Activate user should be true or false.' },
            isBoolean: validators.isBoolean('Activate user should be true or false.')
        }
    }
}, {
    underscored: true,
    tableName: 'campaigns',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

Campaign.beforeValidate(async (campaign) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof campaign.name === 'string') campaign.name = campaign.name.trim();
    if (typeof campaign.url === 'string') campaign.url = campaign.url.toLowerCase().trim();
    if (typeof campaign.description_short === 'string') campaign.description_short = campaign.description_short.trim();
    if (typeof campaign.description_long === 'string') campaign.description_long = campaign.description_long.trim();
});

module.exports = Campaign;
