const { Sequelize, sequelize } = require('../lib/sequelize');
const Event = require('./Event');

const Application = sequelize.define('application', {
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            async isValid(value) {
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
    first_name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'First name should be set.' }
        }
    },
    last_name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Last name should be set.' }
        }
    },
    body_name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body name should be set.' }
        }
    },
    status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
        defaultValue: 'pending',
        validate: {
            isIn: {
                args: [['pending', 'accepted', 'rejected']],
                msg: 'Participant status should be one of these: "pending", "accepted", "rejected".'
            }
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
}, { underscored: true, tableName: 'applications' });

module.exports = Application;
