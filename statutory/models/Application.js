const { Sequelize, sequelize } = require('../lib/sequelize');

const Application = sequelize.define('application', {
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'User ID should be set.' },
            isInt: { msg: 'User ID should be a number.' }
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body ID should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
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
                // For now, it's catched in endpoint handlers while checking if all questions are answered.
                // TODO: fix when figure out how to check if all questions are answered within this validation.

                /* if (typeof value === 'undefined' || value === '') {
                    throw new Error('Answers should be set.');
                }
                if (!Array.isArray(value)) {
                    throw new Error('Answers should be an array of strings.');
                }

                if (value.length < 1) {
                    throw new Error('At least one answer should be presented.');
                } */

                for (const answer of value) {
                    if (answer.trim().length === 0) {
                        throw new Error('Answers should not be empty.');
                    }
                }
            }
        }
    },
    participant_type: {
        type: Sequelize.ENUM('delegate', 'observer', 'envoy', 'visitor'),
        defaultValue: null,
        validate: {
            isIn: {
                args: [['delegate', 'observer', 'envoy', 'visitor']],
                msg: 'Participant type should be one of these: "delegate", "observer", "envoy", "visitor".'
            }
        }
    },
    status: {
         type: Sequelize.ENUM('pending', 'requesting', 'accepted', 'rejected'),
         defaultValue: 'pending',
         validate: {
            isIn: {
                args: [['pending', 'requesting', 'accepted', 'rejected']],
                msg: 'Participant status should be one of these: "pending", "requesting", "accepted", "rejected".'
            }
        }
    },
    cancelled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBooleanOrEmpty (val) {
                if (typeof val !== 'undefined' && val !== true && val !== false) {
                    throw new Error('The value should be either true or false.');
                }
            }
        }
    },
    paid_fee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    attended: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, { underscored: true });

module.exports = Application;