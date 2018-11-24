const { Sequelize, sequelize } = require('../lib/sequelize');
const Event = require('./Event');

function isBooleanOrEmpty(val) {
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
            async isValid (value) {
                if (typeof value !== 'number') {
                    throw new Error('User ID must be a number.');
                }

                const application = await Application.findOne({ where: {
                    event_id: this.event_id,
                    user_id: this.user_id
                } });

                if (application) {
                    throw new Error('The application for this event from this user already exists.');
                }
            }
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
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '',
        validate: {
            async isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Answers should be an array of strings.');
                }

                const event = await Event.findOne({ where: { id: this.event_id } });
                /* istanbul ignore next */
                if (!event) {
                    throw new Error('Could not find event.');
                }

                if (event.questions.length !== value.length) {
                    throw new Error(`Expected ${event.questions.length} answers, but got ${value.length}.`);
                }

                for (let index = 0; index < value.length; index++) {
                    switch (event.questions[index].type) {
                    case 'string':
                    case 'text':
                        if (typeof value[index] !== 'string') {
                            throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}"): expected a string, got ${typeof value[index]}.`);
                        }

                        if (value[index].trim().length === 0 && event.questions[index].required) {
                            throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}") is empty.`);
                        }
                        break;
                    case 'number':
                        if (Number.isNaN(Number(value[index]))) {
                            throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}") should be a number, but got "${value[index]}".`);
                        }
                        break;
                    case 'select':
                        if (!event.questions[index].values.includes(value[index])) {
                            throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}") should be one of these: ${event.questions[index].values.join(', ')}, but got "${value[index]}".`);
                        }
                        break;
                    case 'checkbox':
                        if (typeof value[index] !== 'boolean') {
                            throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}"): type should be boolean, but got "${typeof value[index]}".`);
                        }
                        break;
                    /* istanbul ignore next */
                    default:
                        throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}"): unknown question type: ${event.questions[index].type}`);
                    }
                }
            }
        }
    },
    participant_type: {
        type: Sequelize.ENUM('delegate', 'observer', 'envoy', 'visitor'),
        defaultValue: null,
        validate: {
            isValid (value) {
                const possibleValies = ['delegate', 'observer', 'envoy', 'visitor'];

                // pax type is either null or one of the possible values.
                if (value !== null && !possibleValies.includes(value)) {
                    return new Error('Participant type should be either null or one of these: "delegate", "observer", "envoy", "visitor".');
                }

                // also, pax type should be set up together with pax order.
                if (value !== null && this.participant_order === null) {
                    throw new Error('Participant type is set, but participant order is not.');
                }
            }
        }
    },
    participant_order: {
        type: Sequelize.INTEGER,
        defaultValue: null,
        validate: {
            async isValid (value) {
                // Should be either string or null.
                if (value !== null && typeof value !== 'number') {
                    throw new Error('Participant order should be either null or string.');
                }

                // This number should be positive.
                if (typeof value === 'number' && value <= 0) {
                    throw new Error('Participant order should be positive.');
                }

                // Also, pax order should be set up together with pax (either both of them or none).
                if (value !== null && this.participant_type === null) {
                    throw new Error('Participant order is set, but participant type is not.');
                }

                // Check if there's already the application with the same event_id, body_id, type and order.
                if (value !== null) {
                    const application = await Application.findOne({ where: {
                        event_id: this.event_id,
                        body_id: this.body_id,
                        participant_type: this.participant_type,
                        participant_order: value
                    } });

                    if (application) {
                        throw new Error('The application for this event from this body with this participant type and order already exists.');
                    }
                }
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
