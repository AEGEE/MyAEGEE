const { Sequelize, sequelize } = require('../lib/sequelize');

const Body = sequelize.define('body', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Name must be set.' },
        }
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Description must be set.' },
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
        validate: {
            notEmpty: { msg: 'Code must be set.' },
            isAlpha: { msg: 'Code must contain only letters.' },
            len: { args: [3, 3], msg: 'Code must be 3 letters long.' }
        },
        unique: true
    },
    abbreviation: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Email must be set.' },
            isEmail: { msg: 'Email must be valid.' }
        }
    },
    phone: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            notEmpty: { msg: 'Phone must be set.' },
        }
    },
    address: {
        type: Sequelize.TEXT,
        allowNull: true,
        validate: {
            notEmpty: { msg: 'Address must be set.' },
        }
    },
    postal_address: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    type: {
        type: Sequelize.ENUM('antenna', 'contact antenna', 'contact', 'interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other'),
        allowNull: false,
        defaultValue: 'antenna',
        validate: {
            isIn: {
                args: [['antenna', 'contact antenna', 'contact', 'interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other']],
                msg: 'Type must be one of these: "antenna", "contact antenna", "contact", "interest group", "working group", "commission", "committee", "project", "partner", "other".'
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
        allowNull: true,
        defaultValue: null,
        validate: {
            isValid(value) {
                if (['antenna', 'contact antenna', 'contact'].includes(this.type) && value === null) {
                    throw new Error('Foundation date must be set');
                }
            }
        }
    },
    status: {
        type: Sequelize.ENUM('active', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
        validate: {
            isIn: {
                args: [['active', 'deleted']],
                msg: 'Status must be one of these: "active", "deleted".'
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
    gsuite_id: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            isEmail: { msg: 'GSuite ID must be a valid email.' }
        },
        unique: true
    },
    google_group: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            isEmail: { msg: 'Google Group must be a valid email.' }
        },
        unique: true
    }
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
    if (typeof body.gsuite_id === 'string') body.gsuite_id = body.gsuite_id.toLowerCase().trim();
    if (typeof body.google_group === 'string') body.google_group = body.google_group.toLowerCase().trim();

    if (typeof body.abbreviation === 'string') body.abbreviation = body.abbreviation.trim();
});

module.exports = Body;
