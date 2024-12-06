const { Sequelize, sequelize } = require('../lib/sequelize');

const Netcom = sequelize.define('netcom', {
    body_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Body should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        }
    },
    netcom_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            isInt: { msg: 'Netcom ID should be a number.' }
        }
    }
}, {
    underscored: true,
    tableName: 'netcom',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Netcom;
