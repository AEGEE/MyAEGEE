const { Sequelize, sequelize } = require('../lib/sequelize');

const Application = sequelize.define('application', {
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'User ID should be set.' }
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        validate: {
            notEmpty: { msg: 'Body ID should be set.' }
        },
    },
    visa_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    board_comment: {
        type: Sequelize.TEXT
    },
    answers: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (typeof value === 'undefined' || value === '') {
                    throw new Error('Answers should be set.');
                }
                if (!Array.isArray(value)) {
                    throw new Error('Answers should be an array of strings.');
                }

                if (value.length < 1) {
                    throw new Error('At least one answer should be presented.');
                }

                for (const answer of value) {
                    if (answer.trim().length === 0) {
                        throw new Error('Answers should not be empty.');
                    }
                }
            }
        }
    },
    participant_type: {
        type: Sequelize.ENUM('delegate', 'observer', 'envoy', 'visitor')
    },
    status: {
         type: Sequelize.ENUM('pending', 'requesting', 'accepted', 'rejected')
    },
    cancelled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    paid_fee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    attented: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, { underscored: true });

module.exports = Application;