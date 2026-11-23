const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');

const Netcom = sequelize.define('netcom', {
    body_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        validate: {
            notNull: { msg: 'Body should be set.' },
            notEmpty: { msg: 'Body should be set.' },
            ...helpers.idValidators('Body ID')
        }
    },
    netcom_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notNull: { msg: 'NetCom should be set.' },
            ...helpers.idValidators('NetCom ID')
        }
    }
}, {
    underscored: true,
    tableName: 'netcom',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Netcom;
