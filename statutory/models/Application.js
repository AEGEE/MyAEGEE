const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const Event = require('./Event');
const MembersList = require('./MembersList');

function isBoolean(val) {
    if (typeof val !== 'boolean') {
        throw new Error('The value should be true or false.');
    }
}

const Application = sequelize.define('application', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            isInt: { msg: 'User ID should be a number.' }
        },
        unique: { args: true, msg: 'There\'s already an application with such user ID for this event.' }
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
            isBoolean
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

                        if (value[index] !== true && event.questions[index].required) {
                            throw new Error(`Answer number ${index + 1} ("${event.questions[index].description}"): you should agree.`);
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
        allowNull: true,
        type: Sequelize.ENUM('delegate', 'observer', 'envoy', 'visitor'),
        validate: {
            isIn: {
                args: [['delegate', 'observer', 'envoy', 'visitor']],
                msg: 'Participant type should be one of these: "delegate", "observer", "envoy", "visitor".'
            }
        },
        unique: {
            args: true,
            msg: 'There\'s already an application with such participant type and order for this event.'
        }
    },
    participant_order: {
        allowNull: true,
        type: Sequelize.INTEGER,
        validate: {
            isInt: { msg: 'Participant order should be valid.' },
            min: { args: [1], msg: 'Participant order cannot be negative' }
        },
        unique: {
            args: true,
            msg: 'There\'s already an application with such participant type and order for this event.'
        }
    },
    status: {
        type: Sequelize.ENUM('pending', 'waiting_list', 'accepted', 'rejected'),
        defaultValue: 'pending',
        validate: {
            isIn: {
                args: [['pending', 'waiting_list', 'accepted', 'rejected']],
                msg: 'Participant status should be one of these: "pending", "waiting_list", "accepted", "rejected".'
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
    paid_fee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean,
            notAllowIfCancelled(value) {
                if (this.cancelled && value) {
                    throw new Error('This application is cancelled, you cannot mark it as paid fee.');
                }
            },
            notAllowIfAttended(value) {
                if (!value && this.attended) {
                    throw new Error('This application is markedd as attended, you cannot mark it as not paid fee.');
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
            notAllowIfNotPaidFee(value) {
                if (!this.paid_fee && value) {
                    throw new Error('You should set user as paid fee first.');
                }
            }
        }
    },
    registered: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean,
            notAllowIfNotPaidFee(value) {
                if (!this.paid_fee && value) {
                    throw new Error('You should set user as paid fee first.');
                }
            },
            notAllowIfDeparted(value) {
                if (!value && this.departed) {
                    throw new Error('This application is marked as departed, you cannot mark it as not registered.');
                }
            }
        }
    },
    departed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean,
            notAllowIfNotRegistered(value) {
                if (!this.registered && value) {
                    throw new Error('You should set user as attended first.');
                }
            }
        }
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
    email: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Email should be set.' },
            isEmail: { msg: 'Email should be valid.' }
        }
    },
    gender: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Gender should be set.' }
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
    nationality: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Nationality should be set.' }
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
    date_of_birth: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Date of birth should be set.' }
        }
    },
    number_of_events_visited: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Number of events visited should be set.' },
            isNumeric: { msg: 'Number of events visited should be valid.' },
            min: { args: [0], msg: 'Number of events visited cannot be negative' }
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
    is_on_memberslist: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isBoolean
        }
    },
    statutory_id: {
        // no validation because it's set automatically in pre-create hook
        // allowNull: true is here for the same reason
        type: Sequelize.STRING,
        allowNull: true
    }
}, {
    underscored: true,
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
        },
        async participantTypeShouldBeSetWithOrder() {
            if (this.participant_type !== null && this.participant_order === null) {
                throw new Error('Participant type is set, but participant order is not.');
            }

            if (this.participant_order !== null && this.participant_type === null) {
                throw new Error('Participant order is set, but participant type is not.');
            }
        }
    }
});

Application.findWithParams = ({ where, attributes, query }) => {
    const findAllObject = { where };

    if (helpers.isDefined(attributes)) {
        findAllObject.attributes = attributes;
    }

    // Trying to apply limit and offset.
    for (const key of ['limit', 'offset']) {
        // If not defined, ignoring it.
        if (!helpers.isDefined(query[key])) {
            continue;
        }

        findAllObject[key] = Number(query[key]);
    }

    // Sorting by ID desc by default.
    const sorting = [['id', 'desc']];

    // Trying to apply sorting fields.
    if (helpers.isObject(query.sort)) {
        if (helpers.isDefined(query.sort.field)) {
            sorting[0][0] = query.sort.field;
        }

        if (helpers.isDefined(query.sort.order)) {
            sorting[0][1] = query.sort.order;
        }
    }

    // Trying to apply filtering.
    // Only filtering by first name, last name and email is supported.
    if (query.query) {
        findAllObject.where[Sequelize.Op.or] = {
            first_name: { [Sequelize.Op.iLike]: '%' + query.query + '%' },
            last_name: { [Sequelize.Op.iLike]: '%' + query.query + '%' },
            email: { [Sequelize.Op.iLike]: '%' + query.query + '%' }
        };
    }

    if (!query.displayCancelled) {
        findAllObject.where.cancelled = false;
    }

    findAllObject.order = sorting;

    return Application.findAndCountAll(findAllObject);
};

// Updating the users' inclusion in memberslist for this body.
Application.afterValidate(async (application, options) => {
    // Skipping if not Agora.
    const event = await Event.findByPk(application.event_id);
    if (event.type !== 'agora') {
        return;
    }
    const memberslistForBody = await MembersList.findOne({ where: {
        body_id: application.body_id,
        event_id: application.event_id
    } });

    options.fields.push('is_on_memberslist');
    application.setDataValue('is_on_memberslist', helpers.memberslistHasMember(memberslistForBody, application));
});

// Generating and setting statutory_id
Application.beforeCreate(async (application, options) => {
    const applicationsCount = await Application.count({
        where: { event_id: application.event_id }
    });

    const newStatutoryId = application.event_id.toString().padStart(3, '0')
        + '-'
        + (applicationsCount + 1).toString().padStart(4, '0');

    options.fields.push('statutory_id');
    application.setDataValue('statutory_id', newStatutoryId);
});

module.exports = Application;
