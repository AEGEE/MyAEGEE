const { Sequelize, sequelize } = require('../lib/sequelize');

const Body = sequelize.define('body', {
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
        }
    },
    task_description: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: ''
    },
    code: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Code should be set.' },
        },
        unique: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            notEmpty: { msg: 'Email should be set.' }
        }
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Phone should be set.' },
        }
    },
    address: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Phone should be set.' },
        }
    },
    type: {
        type: Sequelize.ENUM('antenna', 'contact antenna', 'contact', 'interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other'),
        allowNull: false,
        defaultValue: 'antenna',
        validate: {
            isIn: {
                args: [['antenna', 'contact antenna', 'contact', 'interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other']],
                msg: 'Type should be one of these: "antenna", "contact antenna", "contact", "interest group", "working group", "commission", "committee", "project", "partner", "other".'
            }
        }
    },
    fee_currency: {
        type: Sequelize.STRING,
        allowNull: true
    },
    pays_fees: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    founded_at: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
    },
    status: {
        type: Sequelize.ENUM('active', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
        validate: {
            isIn: {
                args: [['active', 'deleted']],
                msg: 'Status should be one of these: "active", "deleted".'
            }
        }
    },
    country: {
        type: Sequelize.STRING,
        allowNull: true
    },
    website: {
        type: Sequelize.STRING,
        allowNull: true
    },
}, {
    underscored: true,
    tableName: 'bodies',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

Body.beforeValidate(async (body) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof body.code === 'string') body.code = body.code.toUpperCase().trim();
    if (typeof body.email === 'string') body.email = body.email.toLowerCase().trim();
});

module.exports = Body;
