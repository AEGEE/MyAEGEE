const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');

const Netcom = sequelize.define('netcom', {
    body_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Body should be set.' },
            isInt: { msg: 'Body ID should be a number.' },
            ...helpers.idRange('Body ID')
        }
    },
    netcom_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            isInt: { msg: 'Netcom ID should be a number.' },
            ...helpers.idRange('NetCom ID')
        }
    }
}, {
    underscored: true,
    tableName: 'netcom',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Netcom;
