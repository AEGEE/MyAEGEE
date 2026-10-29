const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

// A voting is one question that the Agora votes on: a proposal or a rollcall.
// The JC creates it with a fixed time window. It opens by itself at opens_at (which takes
// a snapshot of who can vote and how much) and closes by itself at closes_at (which stores
// the result), see lib/voting_lifecycle.js. The JC then publishes the result.
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
    opens_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'The time when the voting opens should be set.' },
            isDate: { msg: 'The time when the voting opens should be valid.' }
        }
    },
    closes_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'The time when the voting closes should be set.' },
            isDate: { msg: 'The time when the voting closes should be valid.' },
            laterThanOpening(val) {
                if (moment(val).isSameOrBefore(this.opens_at)) {
                    throw new Error('A voting should close after it opens.');
                }
            }
        }
    },
    status: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'scheduled',
        validate: {
            isIn: {
                args: [['scheduled', 'open', 'closed']],
                msg: 'Voting status should be one of these: "scheduled", "open", "closed".'
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
    closed_at: {
        allowNull: true,
        type: Sequelize.DATE
    },
    published: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    published_at: {
        allowNull: true,
        type: Sequelize.DATE
    },
    published_by: {
        allowNull: true,
        type: Sequelize.INTEGER
    }
}, {
    underscored: true,
    tableName: 'votings',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Schedules the opening and the closing. If a job is missed (for example the server was down),
// the next request for the voting or the next start of the server still opens or closes it.
Voting.afterUpdate((voting) => {
    // Required here to prevent circular dependencies, as in the other models with deadlines.
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    cron.clearJobs(cron.JOB_TYPES.OPEN_VOTING, { id: voting.id });
    cron.clearJobs(cron.JOB_TYPES.CLOSE_VOTING, { id: voting.id });
});

Voting.afterSave((voting) => {
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    if (voting.status === 'scheduled') {
        cron.addJob(cron.JOB_TYPES.OPEN_VOTING, voting.opens_at, { id: voting.id });
    }
    if (voting.status !== 'closed') {
        cron.addJob(cron.JOB_TYPES.CLOSE_VOTING, voting.closes_at, { id: voting.id });
    }
});

Voting.afterDestroy((voting) => {
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    cron.clearJobs(cron.JOB_TYPES.OPEN_VOTING, { id: voting.id });
    cron.clearJobs(cron.JOB_TYPES.CLOSE_VOTING, { id: voting.id });
});

module.exports = Voting;
