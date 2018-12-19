const { Sequelize, sequelize } = require('../lib/sequelize');

const Candidate = sequelize.define('candidate', {
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
    first_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'First name should be set.' }
        }
    },
    last_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Last name should be set.' }
        }
    },
    date_of_birth: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Date of birth should be set.' },
            isDate: { msg: 'Date of birth should be valid.' }
        }
    },
    gender: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Gender should be set.' }
        }
    },
    nationality: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Nationality should be set.' }
        }
    },
    position_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position should be set.' },
            isInt: { msg: 'Position ID should be a number.' }
        },
    },
    body_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body name should be set.' }
        }
    },
    languages: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Languages should be an array.');
                }

                if (value.length === 0) {
                    throw new Error('Please specify at least 1 language.');
                }

                for (const lang of value) {
                    if (typeof lang !== 'string') {
                        throw new Error('Language should be a string.');
                    }

                    if (lang.trim().length === 0) {
                        throw new Error('Language should not be empty.');
                    }
                }
            }
        }
    },
    studies: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Studies should be set.' }
        }
    },
    member_since: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in since when you are a member.' },
            isDate: { msg: 'Date of since when you are a member should be valid.' }
        }
    },
    european_experience: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your european experience.' },
        }
    },
    local_experience: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your local experience.' },
        }
    },
    attended_agorae: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your attended Agorae.' },
        }
    },
    attended_epm: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your attended EPM/EBM.' },
        }
    },
    attended_conferences: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your attended AEGEE conferences.' },
        }
    },
    external_experience: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your non-AEGEE experience.' },
        }
    },
    motivation: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your motivation.' },
        }
    },
    program: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in the program.' },
        }
    },
    related_experience: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your experience related to position.' },
        }
    },
    status: {
        type: Sequelize.ENUM('approved', 'rejected', 'pending'),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
            notEmpty: { msg: 'Candidature status should be set.' },
            isIn: {
                args: [['approved', 'rejected', 'pending']],
                msg: 'Candidature status should be one of these: "approved", "rejected", "pending".'
            }
        }
    },
}, { underscored: true, tableName: 'candidates' });

module.exports = Candidate;
