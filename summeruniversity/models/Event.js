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
                    throw new Error('Event URL should have at least 1 letter.');
                }
                // TODO: not the same as url from statutory or events (also add that in the others)
            }
        },
        unique: true
    },
    image: {
        type: Sequelize.STRING,
        allowNull: true
    },
    photos: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        // TODO: max 6 photos
    },
    video: {
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
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Email should be given.' },
            isEmail: { msg: 'Given email is not valid.' }
        }
    },
    website: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            // isUrl: { msg: 'The provided link is not a valid URL.' }
        }
    },
    social_media: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        validate: {
            // TODO: all are links
            // isUrl: { msg: 'The provided link is not a valid URL.' }
            // TODO: max 3 links
        }
    },
    // application_starts: {
    //     type: Sequelize.DATE,
    //     allowNull: true,
    //     validate: {
    //         // isDate: { msg: 'Event application start date should be set.' }
    //         // TODO: check if timeframe set by SUCT
    //         // TODO: only done by SUCT
    //     }
    // },
    // application_ends: {
    //     type: Sequelize.DATE,
    //     allowNull: true,
    //     validate: {
    //         // isDate: { msg: 'Event application end date should be set.' },
    //         // laterThanApplicationStart(val) {
    //         //     if (moment(val).isSameOrBefore(this.application_starts)) {
    //         //         throw new Error('Application period cannot start after or at the same time it ends.');
    //         //     }
    //         // },
    //         // beforeEventStart(val) {
    //         //     if (moment(val).isSameOrAfter(this.starts)) {
    //         //         throw new Error('Application period cannot end before or at the same time the event starts.');
    //         //     }
    //         // }
    //         // TODO: check if timeframe set by SUCT
    //         // TODO: only done by SUCT
    //         // TODO: see how we want to do extended open call close (SUCT will open, organizers will close)
    //     }
    // },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event start date should be set.' },
            isDate: { msg: 'Event start date should be valid.' }
            // TODO: check if timeframe set by SUCT
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
            // TODO: check if timeframe set by SUCT
            // TODO: check for duration, not too short nor too long
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
            // TODO: check how we want to check for the maximal fee (14 euro per day, exception possible), especially with exception
            // TODO: on frontend add warning for maximum fee, not validate on database
        }
    },
    optional_fee: {
        type: Sequelize.DECIMAL,
        allowNull: true,
        validate: {
            // isNumeric: { msg: 'Optional fee should be valid.' },
            // min: { args: [0], msg: 'Optional fee cannot be negative' },
            // max: { args: [40], msg: 'Optional fee cannot be more than 40 euros.' }
        }
    },
    organizing_bodies: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValid(value) {
                // TODO: validate for locals
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
    cooperation: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        validate: {
            isValid(value) {
                // TODO: validate for non-locals (or whatever EBs are allowed to do this)
                // TODO: max 2
                if (!Array.isArray(value)) {
                    throw new Error('TODO should be an array.');
                }

                for (const body of value) {
                    if (typeof body !== 'object' || body === null) {
                        throw new Error('Body is malformed.');
                    }

                    if (typeof body.body_id !== 'number') {
                        throw new Error('body_id should be an integer.');
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
            // TODO: check if we want to keep track of the order here or make seperate values for starting and ending locations
            // TODO: only order of start and end is important, the rest not
            // TODO: so might be good to keep track of starting and ending location seperately in the database
            // TODO: add optional description per location
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
        // TODO: check with SUCT if these are the only types
        type: Sequelize.ENUM('regular', 'pilot'),
        allowNull: false,
        defaultValue: 'regular',
        validate: {
            notEmpty: { msg: 'SU type should be set.' },
            isIn: {
                args: [['regular', 'pilot']],
                msg: 'SU type should be one of these: normal, pilot.'
            }
        }
    },
    theme_category: {
        type: Sequelize.ENUM('arts_creativity', 'sustainability', 'local_culture', 'sports', 'social_equity', 'political_activism', 'mental_health', 'leisure'),
        allowNull: false,
        defaultValue: 'leisure',
        validate: {
            notEmpty: { msg: 'Theme should be set.' },
            isIn: {
                args: [['arts_creativity', 'sustainability', 'local_culture', 'sports', 'social_equity', 'political_activism', 'mental_health', 'leisure']],
                msg: 'Theme should be one of these: arts_creativity, sustainability, local_culture, sports, volunteering, social_equity, political_activism, mental_health, leisure.'
            }
        }
    },
    theme: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Theme explanation should be set.' },
        }
    },
    theme_implementation: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Explanation of theme implementation should be set.' },
        }
    },
    learning_objectives: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        validate: {
            notEmpty: { msg: 'Learning objectives should be set.' },
            // TODO: min 2 and max 5 learning objectives
        }
    },
    status: {
        // TODO: check with SUCT which statuses are possible
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
                // TODO: add optional function
                // TODO: keep track of body ID
                // TODO: validate for 1 main coordinator per local, 1 content manager, 1 treasurer, 1 incoming responsible
                // TODO: in frontend two columns, 1st for name + local, 2nd for optional function
                if (!Array.isArray(value)) {
                    throw new Error('Organizers should be an array.');
                }

                if (value.length === 0) {
                    throw new Error('At least 1 organizer should be presented.');
                }

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
    trainers: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    questions: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        validate: {
            isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Event questions should be an array of strings.');
                }
            }
        }
    },
    pax_description: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    pax_confirmation: {
        type: Sequelize.ENUM('no confirmation', 'payment', 'ticket', 'payment OR ticket', 'payment AND ticket'),
        validate: {
            isIn: {
                args: [['no confirmation', 'payment', 'ticket', 'payment OR ticket', 'payment AND ticket']],
                msg: 'Theme should be one of these: no confirmation, payment, ticket, payment OR ticket, payment AND ticket.'
            }
        }
    },
    max_participants: {
        // TODO: min 15 participants
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
            // return moment().isBetween(this.application_starts, this.application_ends, null, '[]')
            //     ? 'open'
            //     : 'closed'; // inclusive
            return 'closed';
        }
    },
    budget: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
            isUrl: { msg: 'The provided link is not a valid URL.' }
        }
    },
    programme_suct: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'The programme for SUCT should be set.' },
            isUrl: { msg: 'The provided link is not a valid URL.' }
        }
    },
    programme: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    activities_list: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    optional_programme: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    course_level: {
        type: Sequelize.STRING,
        allowNull: true
    },
    courses: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    accommodation_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'The type of accommodation should be set.' },
        }
    },
    special_equipment: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    university_support: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    agreed_to_su_terms: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
            isValid(value) {
                if (value !== true) {
                    throw new Error('You should agree to the SU terms.');
                }
            }
        }
    }
},
{
    underscored: true,
    tableName: 'events',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    validate: {
        // TODO: first submission complete validation, based on date? or on status?
        // TODO: second submission complete validation, based on date? or on status?
        // is_budget_set() {
        //     if (this.status === 'draft') {
        //         return;
        //     }

        //     if (typeof this.budget !== 'string') {
        //         throw new Error('Budget should be a string when the event status is not "draft".');
        //     }

        //     if (this.budget.trim().length === 0) {
        //         throw new Error('Budget cannot be empty when the event status is not "draft".');
        //     }
        // },
        // is_programme_set() {
        //     if (this.status === 'draft') {
        //         return;
        //     }

        //     if (typeof this.programme !== 'string') {
        //         throw new Error('Programme should be a string when the event status is not "draft".');
        //     }

        //     if (this.programme.trim().length === 0) {
        //         throw new Error('Programme cannot be empty when the event status is not "draft".');
        //     }
        // }
    }
});

module.exports = Event;
