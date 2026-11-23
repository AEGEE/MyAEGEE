const { Sequelize, sequelize } = require('../lib/sequelize');

const Integration = sequelize.define('integration', {
    name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Integration name should be set.' },
            len: { args: [0, 255], msg: 'Integration name should be at most 255 characters long.' }
        },
    },
    code: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Integration code should be set.' },
            len: { args: [0, 255], msg: 'Integration code should be at most 255 characters long.' }
        },
        unique: {
            args: true,
            msg: 'Integration code is already taken.'
        }
    },
    quota_period: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Integration quota period should be set.' },
            isIn: {
                args: [['day', 'month', 'year']],
                msg: 'Integration quota period should be one of these: "day", "month", "year".'
            }
        },
    },
    quota_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Integration quota amount should be set.' },
            isInt: { msg: 'Integration quota amount should be valid.' },
            min: { args: [1], msg: 'Integration quota amount cannot be negative or null.' }
        },
    },
    description: {
        type: Sequelize.TEXT
    }
}, {
    underscored: true,
    tableName: 'integrations',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Integration;
