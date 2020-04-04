const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Payment = sequelize.define('payment', {
    starts: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Starts date should be set.' },
            isDate: { msg: 'Starts date should be valid.' }
        }
    },
    expires: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Expiration date should be set.' },
            isDate: { msg: 'Expiration date should be valid.' },
            laterThanStarts(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Expiration date should be after the start date.');
                }
            },
        }
    },
    amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Amount should be set.' },
            isInt: { msg: 'Amount should be valid.' },
            min: { args: [0], msg: 'Amount cannot be negative.' }
        }
    },
    currency: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Currency should be set.' }
        }
    },
    comment: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    invoice_name: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    invoice_address: {
        type: Sequelize.TEXT,
        allowNull: true
    }
}, {
    underscored: true,
    tableName: 'payments',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

Payment.beforeValidate(async (payment) => {
    // skipping these fields if they are unset, will catch it later.
    if (typeof payment.currency === 'string') payment.currency = payment.currency.trim();
    if (typeof payment.comment === 'string') payment.comment = payment.comment.trim();
    if (typeof payment.invoice_name === 'string') payment.invoice_name = payment.invoice_name.trim();
    if (typeof payment.invoice_address === 'string') payment.invoice_address = payment.invoice_address.trim();
});

module.exports = Payment;
