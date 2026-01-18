const { Sequelize, sequelize } = require('../lib/sequelize');
const Event = require('./Event');

function isBoolean(val) {
    if (typeof val !== 'boolean') {
        throw new Error('The value should be true or false.');
    }
}

const Application = sequelize.define('application', {
    // TODO: check that birth date and gender are retrieved from user
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            async isValid(value) {
                /* istanbul ignore next */
                if (typeof value !== 'number') {
                    throw new Error('User ID must be a number.');
                }

                const application = await Application.findOne({ where: {
                    event_id: this.event_id,
                    user_id: this.user_id
                } });

                /* istanbul ignore next */
                if (application) {
                    throw new Error('The application for this event from this user already exists.');
                }
            }
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
    nationality: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Nationality should be set.' }
        }
    },
    travelling_from: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Travelling from should be set.' }
        }
    },
    visa_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean
        }
    },
    visa_place_of_birth: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_passport_number: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_passport_issue_date: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_passport_expiration_date: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_passport_issue_authority: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_embassy: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_street_and_house: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_postal_code: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_city: {
        allowNull: true,
        type: Sequelize.STRING
    },
    visa_country: {
        allowNull: true,
        type: Sequelize.STRING
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
    body_name: { // TODO: remove and replace with core query to body_id
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
    confirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean,
            notAllowIfAttended(value) {
                if (!value && this.attended) {
                    throw new Error('This application is marked as attended, you cannot mark it as not confirmed.');
                }
            }
        }
    },
    attended: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean,
            notAllowIfNotConfirmed(value) {
                if (value && !this.confirmed) {
                    throw new Error('This application is not marked as confirmed, you cannot mark it as attended.');
                }
            }
        }
    },
    cancelled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean
        }
    },
    board_comment: {
        type: Sequelize.TEXT
    },
    aegee_experience: {
        allowNull: false,
        type: Sequelize.TEXT
    },
    ideal_su: {
        allowNull: false,
        type: Sequelize.TEXT
    },
    motivation: {
        allowNull: false,
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
            }
        }
    },
    meals: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Meals should be set.' }
        }
    },
    allergies: {
        allowNull: true,
        type: Sequelize.TEXT
    },
    agreed_to_privacy_policy: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (value !== true) {
                    throw new Error('You should agree to Privacy Policy.');
                }
            }
        }
    },
    agreed_to_su_terms: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (value !== true) {
                    throw new Error('You should agree to Privacy Policy.');
                }
            }
        }
    }
}, {
    underscored: true,
    tableName: 'applications',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    validate: {
        visaFieldsFilledIn() {
            if (!this.visa_required) {
                return;
            }
            const visaFields = [
                'visa_place_of_birth',
                'visa_passport_number',
                'visa_passport_issue_date',
                'visa_passport_expiration_date',
                'visa_passport_issue_authority',
                'visa_embassy',
                'visa_street_and_house',
                'visa_postal_code',
                'visa_city',
                'visa_country'
            ];

            for (const field of visaFields) {
                if (this[field] === null || typeof this[field] === 'undefined') {
                    throw new Error(`Visa is required, but ${field} is not set.`);
                }

                if (typeof this[field] !== 'string') {
                    throw new Error(`Visa is required, but ${field} is not a string.`);
                }

                if (this[field].trim().length === 0) {
                    throw new Error(`Visa is required, but ${field} is empty.`);
                }
            }
        }
    }
});

module.exports = Application;
