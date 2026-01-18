const { Sequelize, sequelize } = require('../lib/sequelize');

const Code = sequelize.define('code', {
    value: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Code should be set.' },
        },
    },
    integration_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Integration ID should be set.' },
        },
    },
    claimed_by: {
        type: Sequelize.INTEGER
    }
}, {
    underscored: true,
    tableName: 'codes',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Code;
