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
            isDate: { msg: 'Event start date should be valid.' },
            isPresent(val) {
                if (moment().isSameOrAfter(val)) {
                    throw new Error('Event start date cannot be in the past.');
                }
            }
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
            },
            isPresent(val) {
                if (moment().isSameOrAfter(val)) {
                    throw new Error('Event end date cannot be in the past.');
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
            isDate: { msg: 'Event application starts date should be set.' },
            isPresent(val) {
                if (moment().isSameOrAfter(val)) {
                    throw new Error('Application period cannot start in the past.');
                }
            }
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
            },
            isPresent(val) {
                if (moment().isSameOrAfter(val)) {
                    throw new Error('Application period cannot end in the past.');
                }
            }
        }
    },
    bodies: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (typeof value === 'undefined' || value === '') {
                    throw new Error('Event organizing bodies should be set.');
                }
                if (!Array.isArray(value)) {
                    throw new Error('Event organizing bodies should be an array of numbers.');
                }

                if (value.length < 1) {
                    throw new Error('At least one organizing body should be presented.');
                }

                for (const elt of value) {
                    if (Number.isNaN(parseInt(elt, 10))) {
                        throw new Error('Event organizing bodies should be an array of numbers.');
                    }
                }
            }
        }
    },
    questions: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (typeof value === 'undefined' || value === '') {
                    throw new Error('Event questions should be set.');
                }
                if (!Array.isArray(value)) {
                    throw new Error('Event questions should be an array of strings.');
                }

                if (value.length < 1) {
                    throw new Error('At least one question should be presented.');
                }

                for (const question of value) {
                    if (question.trim().length === 0) {
                        throw new Error('Questions should not be empty.');
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
        type: Sequelize.ENUM('agora', 'epm'),
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event type should be set.' },
            isIn: {
                args: [['agora', 'epm']],
                msg: 'Event type should be one of these: "agora", "epm".'
            }
        }
    },
    can_apply: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isBetween(this.application_period_starts, this.application_period_ends, null, '[]'); // inclusive
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
}, { underscored: true });

Event.beforeValidate((event, options) => {
    if (!event.url) event.setDataValue('url', event.name.toLowerCase().replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, ''));
    options.fields.push('url');
});

module.exports = Event;
