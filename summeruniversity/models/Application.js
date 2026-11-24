const { Sequelize, sequelize } = require('../lib/sequelize');
const Event = require('./Event');
const {
    isOneOf, isInteger, plainSetter, isBoolean, isText
} = require('../lib/validators');

// Every STRING column is a varchar(255): longer values are a validation error, not a database error.
const STRING_LENGTH = {
    len: { args: [0, 255], msg: 'This text should be at most 255 characters long.' }
};

const Application = sequelize.define('application', {
    // TODO: check that birth date and gender are retrieved from user
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
    first_name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isText,
            ...STRING_LENGTH,
            notEmpty: { msg: 'First name should be set.' }
        }
    },
    last_name: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isText,
            ...STRING_LENGTH,
            notEmpty: { msg: 'Last name should be set.' }
        }
    },
    nationality: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isText,
            ...STRING_LENGTH,
            notEmpty: { msg: 'Nationality should be set.' }
        }
    },
    travelling_from: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isText,
            ...STRING_LENGTH,
            notEmpty: { msg: 'Travelling from should be set.' }
        }
    },
    visa_required: {
        type: Sequelize.BOOLEAN,
        set: plainSetter('visa_required'),
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean
        }
    },
    visa_place_of_birth: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_passport_number: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_passport_issue_date: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_passport_expiration_date: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_passport_issue_authority: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_embassy: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_street_and_house: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_postal_code: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_city: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    visa_country: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isText,
            ...STRING_LENGTH
        }
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body should be set.' },
            isInteger: isInteger('Body ID should be a number.')
        },
    },
    body_name: { // TODO: remove and replace with core query to body_id
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isText,
            ...STRING_LENGTH,
            notEmpty: { msg: 'Body name should be set.' }
        }
    },
    status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
        defaultValue: 'pending',
        validate: {
            isOneOf: isOneOf(['pending', 'accepted', 'rejected'], 'Participant status should be one of these: "pending", "accepted", "rejected".')
        }
    },
    confirmed: {
        type: Sequelize.BOOLEAN,
        set: plainSetter('confirmed'),
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
        set: plainSetter('attended'),
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
        set: plainSetter('cancelled'),
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean
        }
    },
    board_comment: {
        type: Sequelize.TEXT,
        validate: {
            isText
        }
    },
    aegee_experience: {
        allowNull: false,
        type: Sequelize.TEXT,
        validate: {
            isText
        }
    },
    ideal_su: {
        allowNull: false,
        type: Sequelize.TEXT,
        validate: {
            isText
        }
    },
    motivation: {
        allowNull: false,
        type: Sequelize.TEXT,
        validate: {
            isText
        }
    },
    answers: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '',
        validate: {
            async isValid(value) {
                if (!Array.isArray(value) || !value.every((answer) => typeof answer === 'string')) {
                    throw new Error('Answers should be an array of strings.');
                }

                const event = await Event.findOne({ where: { id: this.event_id } });
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
            isText,
            ...STRING_LENGTH,
            notEmpty: { msg: 'Meals should be set.' }
        }
    },
    allergies: {
        allowNull: true,
        type: Sequelize.TEXT,
        validate: {
            isText
        }
    },
    agreed_to_privacy_policy: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        set: plainSetter('agreed_to_privacy_policy'),
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
        set: plainSetter('agreed_to_su_terms'),
        defaultValue: '',
        validate: {
            isValid(value) {
                if (value !== true) {
                    throw new Error('You should agree to the SU terms.');
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
