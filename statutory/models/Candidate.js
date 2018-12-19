const { Sequelize, sequelize } = require('../lib/sequelize');

const Candidate = sequelize.define('Candidate', {
    first_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'First name should be set.' },
        }
    },
    last_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Last name should be set.' },
        }
    },
    date_of_birth: Sequelize.DATE,
    gender: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Gender should be set.' },
        }
    },
    nationality: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Nationality should be set.' },
        }
    },
    position_id: Sequelize.INTEGER,
    body_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body name should be set.' },
        }
    },
    languages: Sequelize.ARRAY(Sequelize.STRING),
    studies: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Studies should be set.' },
        }
    },
    member_since: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in since when you are a member.' },
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
    related_experience: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Please fill in your attended AEGEE conferences.' },
        }
    },
    related_experience: {
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
