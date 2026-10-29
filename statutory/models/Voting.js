const { Sequelize, sequelize } = require('../lib/sequelize');

// A voting is one question that the Agora votes on: a proposal or a rollcall.
// The JC creates it as a draft, opens it (which takes a snapshot of who can vote and how much,
// see lib/votings.js) and closes it (which stores the result).
const Voting = sequelize.define('voting', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    kind: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isIn: {
                args: [['proposal', 'rollcall']],
                msg: 'Voting kind should be one of these: "proposal", "rollcall".'
            }
        }
    },
    title: {
        allowNull: false,
        type: Sequelize.TEXT,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Voting title should be set.' },
        },
    },
    description: {
        allowNull: true,
        type: Sequelize.TEXT
    },
    majority: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isIn: {
                args: [['simple', 'absolute', 'two_thirds']],
                msg: 'Voting majority should be one of these: "simple", "absolute", "two_thirds".'
            }
        }
    },
    status: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'draft',
        validate: {
            isIn: {
                args: [['draft', 'open', 'closed']],
                msg: 'Voting status should be one of these: "draft", "open", "closed".'
            }
        }
    },
    result: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isIn: {
                args: [['accepted', 'rejected']],
                msg: 'Voting result should be one of these: "accepted", "rejected".'
            }
        }
    },
    opened_at: {
        allowNull: true,
        type: Sequelize.DATE
    },
    opened_by: {
        allowNull: true,
        type: Sequelize.INTEGER
    },
    closed_at: {
        allowNull: true,
        type: Sequelize.DATE
    },
    closed_by: {
        allowNull: true,
        type: Sequelize.INTEGER
    }
}, {
    underscored: true,
    tableName: 'votings',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Voting;
