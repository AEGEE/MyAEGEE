const { Sequelize, sequelize } = require('../lib/sequelize');

const Code = sequelize.define('code', {
    value: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Code should be set.' },
            len: { args: [0, 255], msg: 'Code should be at most 255 characters long.' }
        },
    },
    integration_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Integration ID should be set.' },
            isInt: { msg: 'Integration ID should be valid.' },
        },
    },
    claimed_by: {
        type: Sequelize.INTEGER,
        validate: {
            isInt: { msg: 'Claimed by should be valid.' },
        },
    }
}, {
    underscored: true,
    tableName: 'codes',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Code;
