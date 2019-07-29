const moment = require('moment-timezone');

moment.tz.setDefault('CET');

const { Sequelize, sequelize } = require('../lib/sequelize');

// A lot of workarounds here like this one:
// allowNull: false,
// defaultValue: '',
// validate: { notEmpty: 'some-validation' }
// This is an unresolved bug in Sequelize, here is more info on that:
// https://github.com/sequelize/sequelize/issues/1500#issuecomment-347843945
// TODO: Refactor this after this bug will be resolved.

const Event = sequelize.define('event', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event name should be set.' },
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
    description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event description should be set.' },
        }
    },
    status: {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
        validate: {
            isIn: {
                args: [['draft', 'published']],
                msg: 'Event status should be one of these: "draft", "published".'
            }
        }
    },
    application_period_starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event application starts date should be set.' },
            isDate: { msg: 'Event application starts date should be set.' }
        }
    },
    application_period_ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event application ends date should be set.' },
            isDate: { msg: 'Event application ends date should be set.' },
            laterThanApplicationStart(val) {
                if (moment(val).isSameOrBefore(this.application_period_starts)) {
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
    board_approve_deadline: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event board approve deadline should be set.' },
            isDate: { msg: 'Event board approve deadline should be set.' },
            laterThanApplicationEnd(val) {
                if (moment(val).isSameOrBefore(this.application_period_ends)) {
                    throw new Error('Board approve deadline cannot be after or at the same time the aplication period ends.');
                }
            },
            beforeEventStart(val) {
                if (moment(val).isSameOrAfter(this.starts)) {
                    throw new Error('Board approve deadline cannot be before or at the same time the event starts.');
                }
            }
        }
    },
    participants_list_publish_deadline: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Participants list publish deadline should be set.' },
            isDate: { msg: 'Participants list publish deadline should be set.' },
            laterThanBoardApproveDeadline(val) {
                if (moment(val).isSameOrBefore(this.board_approve_deadline)) {
                    throw new Error('Participants list publish deadline cannot be after or at the same time the board approve deadline ends.');
                }
            },
            beforeEventStart(val) {
                if (moment(val).isSameOrAfter(this.starts)) {
                    throw new Error('Participants list publish deadline cannot be before or at the same time the event starts.');
                }
            }
        }
    },
    body_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body ID should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        },
    },
    questions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Event questions should be an array of strings.');
                }

                if (value.length < 1) {
                    throw new Error('At least one question should be presented.');
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
    fee: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event fee should be set.' },
            isNumeric: { msg: 'Event fee should be valid.' },
            min: { args: [0], msg: 'Event fee cannot be negative' }
        }
    },
    type: {
        type: Sequelize.ENUM('agora', 'epm', 'spm'),
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event type should be set.' },
            isIn: {
                args: [['agora', 'epm', 'spm']],
                msg: 'Event type should be one of these: "agora", "epm", "spm".'
            }
        }
    },
    image_id: {
        allowNull: true,
        type: Sequelize.INTEGER,
        validate: {
            isInt: { msg: 'Image ID should be a number.' }
        },
    },
    can_apply: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isBetween(this.application_period_starts, this.application_period_ends, null, '[]'); // inclusive
        }
    },
    can_approve_members: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isBetween(this.application_period_starts, this.board_approve_deadline, null, '[]'); // inclusive
        }
    },
    can_manage_memberslists: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isBetween(this.application_period_starts, this.starts, null, '[]'); // inclusive
        }
    },
    can_see_participants_list: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isAfter(this.participants_list_publish_deadline);
        }
    },
    url: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: {
            args: true,
            msg: 'URL is already taken'
        }
    }
}, {
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Event.beforeValidate((event, options) => {
    if (!event.url) event.setDataValue('url', event.name.toLowerCase().replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, ''));
    options.fields.push('url');
});

module.exports = Event;
