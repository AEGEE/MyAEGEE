const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Event = sequelize.define('event', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event name should be set.' },
        }
    },
    url: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            isValid(value) {
                if (!value) {
                    return;
                }

                if (!value.match(/^[a-zA-Z0-9-]+$/)) {
                    throw new Error('Event URL should only contain numbers, letters and dashes.');
                }

                if (value.match(/^[0-9-]+$/)) {
                    throw new Error('Event URL cannot contain numbers only.');
                }
            }
        },
        unique: true
    },
    image: {
        type: Sequelize.STRING,
        allowNull: true
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event description should be set.' },
        }
    },
    application_starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event application starts date should be set.' },
            isDate: { msg: 'Event application starts date should be set.' }
        }
    },
    application_ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event application ends date should be set.' },
            isDate: { msg: 'Event application ends date should be set.' },
            laterThanApplicationStart(val) {
                if (moment(val).isSameOrBefore(this.application_starts)) {
                    throw new Error('Application period cannot start after or at the same time it ends.');
                }
            },
            beforeEventStart(val) {
                if (moment(val).isSameOrAfter(this.starts)) {
                    throw new Error('Application period cannot end before or at the same time the event starts.');
                }
            }
        }
    },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event start date should be set.' },
            isDate: { msg: 'Event start date should be valid.' }
        }
    },
    ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event end date should be set.' },
            isDate: { msg: 'Event end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Event cannot start after or at the same time it ends.');
                }
            }
        }
    },
    fee: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: 0,
        validate: {
            notEmpty: { msg: 'Event fee should be set.' },
            isNumeric: { msg: 'Event fee should be valid.' },
            min: { args: [0], msg: 'Event fee cannot be negative' }
        }
    },
    organizing_bodies: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Organizing bodies should be an array.');
                }

                if (value.length === 0) {
                    throw new Error('At least 1 organizing body should be presented.');
                }

                for (const body of value) {
                    if (typeof body !== 'object' || body === null) {
                        throw new Error('Body is malformed.');
                    }

                    if (typeof body.body_id !== 'number') {
                        throw new Error('body_id should be an integer.');
                    }

                    if (typeof body.body_name !== 'string') {
                        throw new Error('body_name should be a string.');
                    }

                    if (body.body_name.trim().length === 0) {
                        throw new Error('body_name should not be empty.');
                    }
                }
            }
        }
    },
    locations: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Locations should be an array.');
                }

                for (const position of value) {
                    if (typeof position !== 'object' || position === null) {
                        throw new Error('Position is malformed.');
                    }

                    if (typeof position.name !== 'string') {
                        throw new Error('Name is invalid.');
                    }

                    if (position.name.trim().length === 0) {
                        throw new Error('Name should be presented.');
                    }

                    if (typeof position.position !== 'object' || position.position === null) {
                        throw new Error('Position.position is malformed.');
                    }

                    if (typeof position.position.lat !== 'number') {
                        throw new Error('Latitude is malformed.');
                    }

                    if (typeof position.position.lng !== 'number') {
                        throw new Error('Longitude is malformed.');
                    }
                }
            }
        }
    },
    type: {
        type: Sequelize.ENUM('training', 'nwm', 'conference', 'cultural'),
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event type should be set.' },
            isIn: {
                args: [['training', 'nwm', 'conference', 'cultural']],
                msg: 'Event type should be one of these: training, nwm, conference, cultural.'
            }
        }
    },
    status: {
        type: Sequelize.ENUM('draft', 'submitted', 'published'),
        allowNull: false,
        defaultValue: 'draft',
        validate: {
            isIn: {
                args: [['draft', 'submitted', 'published']],
                msg: 'Event status should be one of these: "draft", "submitted", "published".'
            }
        }
    },
    deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    organizers: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValid(value) {
                /* istanbul ignore next */
                if (!Array.isArray(value)) {
                    throw new Error('Organizers should be an array.');
                }

                if (value.length === 0) {
                    throw new Error('At least 1 organizer should be presented.');
                }

                /* istanbul ignore next */
                for (const organizer of value) {
                    if (typeof organizer !== 'object' || organizer === null) {
                        throw new Error('Organizer is malformed.');
                    }

                    if (!organizer.user_id || typeof organizer.user_id !== 'number') {
                        throw new Error('user_id is malformed.');
                    }

                    if (!organizer.first_name || typeof organizer.first_name !== 'string') {
                        throw new Error('first_name is malformed.');
                    }

                    if (!organizer.last_name || typeof organizer.last_name !== 'string') {
                        throw new Error('last_name is malformed.');
                    }

                    if (typeof organizer.comment !== 'undefined' && typeof organizer.comment !== 'string') {
                        throw new Error('comment is malformed.');
                    }

                    if (typeof organizer.email !== 'undefined' && typeof organizer.email !== 'string') {
                        throw new Error('email is malformed.');
                    }
                }
            }
        }
    },
    questions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Event questions should be an array of strings.');
                }

                for (let index = 0; index < value.length; index++) {
                    const question = value[index];
                    /* Question structure
                    {
                        type: 'string|text|number|checkbox|select',
                        description: 'a line that will appear as a label',
                        required: 'boolean',
                        values: ['an array of strings, required for select']
                    }
                    */

                    if (typeof question !== 'object') {
                        throw new Error(`Question ${index + 1}: should be an object.`);
                    }

                    if (typeof question.description !== 'string' || question.description.trim().length === 0) {
                        throw new Error(`Question ${index + 1}: description should be set.`);
                    }

                    if (typeof question.type !== 'string') {
                        throw new Error(`Question ${index + 1}: type should be set.`);
                    }

                    if (typeof question.required !== 'boolean') {
                        throw new Error(`Question ${index + 1}: required is not a boolean.`);
                    }

                    switch (question.type) {
                    case 'string':
                    case 'text':
                    case 'checkbox':
                    case 'number':
                        break;
                    case 'select':
                        if (!Array.isArray(question.values)) {
                            throw new Error(`Question ${index + 1}: values is not an array.`);
                        }

                        for (const val of question.values) {
                            if (typeof val !== 'string' || val.trim().length === 0) {
                                throw new Error(`Question ${index + 1}: some of the values are empty.`);
                            }
                        }
                        break;
                    default:
                        throw new Error(`Question ${index + 1}: invalid question type: "${question.type}"`);
                    }
                }
            }
        }
    },
    max_participants: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        validate: {
            isNumeric: { msg: 'Max amount of participants should be valid.' },
            min: { args: [0], msg: 'Max amount of participants cannot be negative' }
        }
    },
    application_status: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isBetween(this.application_starts, this.application_ends, null, '[]')
                ? 'open'
                : 'closed'; // inclusive
        }
    },
    budget: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    programme: {
        type: Sequelize.TEXT,
        allowNull: true
    },
}, {
    underscored: true,
    tableName: 'events',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    validate: {
        is_budget_set() {
            if (this.status === 'draft') {
                return;
            }

            if (typeof this.budget !== 'string') {
                throw new Error('Budget should be a string when the event status is not "draft".');
            }

            if (this.budget.trim().length === 0) {
                throw new Error('Budget cannot be empty when the event status is not "draft".');
            }
        },
        is_programme_set() {
            if (this.status === 'draft') {
                return;
            }

            if (typeof this.programme !== 'string') {
                throw new Error('Programme should be a string when the event status is not "draft".');
            }

            if (this.programme.trim().length === 0) {
                throw new Error('Programme cannot be empty when the event status is not "draft".');
            }
        }
    }
});

module.exports = Event;
