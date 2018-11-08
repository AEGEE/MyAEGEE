const { Sequelize, sequelize } = require('../lib/sequelize');
const Event = require('./Event');

function isBooleanOrEmpty (val) {
    if (typeof val !== 'undefined' && val !== true && val !== false) {
        throw new Error('The value should be either true or false.');
    }
}

const Application = sequelize.define('application', {
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'User should be set.' },
            isInt: { msg: 'User ID should be a number.' }
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        },
    },
    visa_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBooleanOrEmpty
        }
    },
    board_comment: {
        type: Sequelize.TEXT
    },
    answers: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: '',
        validate: {
            async isValid(value) {
                if (typeof value === 'undefined' || value === '') {
                    throw new Error('Answers should be set.');
                }
                if (!Array.isArray(value)) {
                    throw new Error('Answers should be an array of strings.');
                }

                const event = await Event.find({ where: { id: this.event_id } });
                if (!event) {
                  throw new Error('Could not find event.');
                }

                if (event.questions.length !== value.length) {
                    throw new Error(`Expected ${event.questions.length} answers, but got ${value.length}.`);
                }

                for (let index = 0; index < value.length; index++) {
                    if (value[index].trim().length === 0) {
                        throw new Error(`Answer number ${index + 1} ("${event.questions[index]}") is empty.`);
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
            isBooleanOrEmpty
        }
    },
    paid_fee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBooleanOrEmpty
        }
    },
    attended: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBooleanOrEmpty
        }
    }
}, { underscored: true });

module.exports = Application;
