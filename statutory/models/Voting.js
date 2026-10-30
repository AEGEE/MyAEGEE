const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const rules = require('../lib/voting_rules');

// A voting is one question that the Agora votes on: a proposal, a rollcall or an election.
// The JC creates it with a fixed time window. It opens by itself at opens_at (which takes
// a snapshot of who can vote and how much) and closes by itself at closes_at (which stores
// the result), see lib/voting_lifecycle.js. The JC then publishes the result.
//
// The phase says when the voting happens:
// - agora: on the Agora itself, by the delegates who are checked in;
// - pre_agora: online before the Agora (Working Format of the Agora, Art. 20), by the delegates
//   of the coming Agora, between days 14 and 9 before it, always with a two-thirds majority
//   and a quorum of half of the Antennae. Its result is published at closing, and its outcome
//   says whether it is binding or whether the Agora votes again.
//
// An election is a voting for a position (position_id): it elects up to seats candidates from the
// ballot (voting_options), with secret ballots and the threshold of its election_rule instead of
// a majority. An election is always on the Agora (Art. 20(6)); see lib/elections.js.

const isSet = (val) => val !== null && typeof val !== 'undefined';

// A Pre-Agora voting must fit in days 14 to 9 before the Agora starts.
// Returns the window, or null when the voting is not a Pre-Agora voting. An election never is one
// (validator electionsOnTheAgora), so it gets no window either.
async function preAgoraWindowOf(voting) {
    if (voting.phase !== 'pre_agora' || voting.kind === 'election') {
        return null;
    }

    const event = await sequelize.models.event.findByPk(voting.event_id, { attributes: ['starts'] });
    return event ? rules.preAgoraWindow(event.starts) : null;
}

const WINDOW_MESSAGE = 'A Pre-Agora voting should happen in days 14 to 9 before the Agora';
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
                args: [['proposal', 'rollcall', 'election']],
                msg: 'Voting kind should be one of these: "proposal", "rollcall", "election".'
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
    // An election has no majority: it elects candidates by its election_rule.
    majority: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isIn: {
                args: [['simple', 'absolute', 'two_thirds']],
                msg: 'Voting majority should be one of these: "simple", "absolute", "two_thirds".'
            },
            // Sequelize also runs custom validators when there is no value.
            matchesKind(val) {
                if (this.kind === 'election' && isSet(val)) {
                    throw new Error('An election has no majority: its election rule decides who is elected.');
                }
                if (this.kind !== 'election' && !isSet(val)) {
                    throw new Error('Voting majority should be one of these: "simple", "absolute", "two_thirds".');
                }
            },
            // Art. 20(3): "All decisions are to be taken by a qualified majority."
            twoThirdsBeforeTheAgora(val) {
                if (this.phase === 'pre_agora' && this.kind !== 'election' && val !== 'two_thirds') {
                    throw new Error('A Pre-Agora voting needs a two-thirds majority.');
                }
            }
        }
    },
    phase: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'agora',
        validate: {
            isIn: {
                args: [['agora', 'pre_agora']],
                msg: 'Voting phase should be one of these: "agora", "pre_agora".'
            },
            keepsAmendmentMark(val) {
                if (val !== 'pre_agora' && this.amendment_submitted) {
                    throw new Error('A voting with an amendment mark stays a Pre-Agora voting; unmark the amendment first.');
                }
            },
            // "Secret ballots and elections are excluded from pre-Agora voting" (Art. 20(6)).
            electionsOnTheAgora(val) {
                if (this.kind === 'election' && val !== 'agora') {
                    throw new Error('An election is always on the Agora: elections are excluded from Pre-Agora Voting.');
                }
            }
        }
    },
    opens_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'The time when the voting opens should be set.' },
            isDate: { msg: 'The time when the voting opens should be valid.' },
            async notBeforeDay14(val) {
                const window = await preAgoraWindowOf(this);
                if (window && val && moment(val).isBefore(window.earliest_opening)) {
                    throw new Error(`${WINDOW_MESSAGE}: it should open at ${window.earliest_opening.toISOString()} or later.`);
                }
            }
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
            },
            async notAfterDay9(val) {
                const window = await preAgoraWindowOf(this);
                if (window && val && moment(val).isAfter(window.latest_closing)) {
                    throw new Error(`${WINDOW_MESSAGE}: it should close at ${window.latest_closing.toISOString()} or earlier.`);
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
    },
    // The position that an election is for. Only an election has one.
    position_id: {
        allowNull: true,
        type: Sequelize.INTEGER,
        validate: {
            matchesKind(val) {
                if (this.kind === 'election' && !Number.isInteger(val)) {
                    throw new Error('An election should have a position.');
                }
                if (this.kind !== 'election' && isSet(val)) {
                    throw new Error('Only an election has a position.');
                }
            }
        }
    },
    // The people that an election elects, and so the most candidates marked on one ballot (Art. 13).
    seats: {
        allowNull: true,
        type: Sequelize.INTEGER,
        validate: {
            matchesKind(val) {
                if (this.kind === 'election' && !(Number.isInteger(val) && val >= 1)) {
                    throw new Error('An election should have 1 seat or more.');
                }
                if (this.kind !== 'election' && isSet(val)) {
                    throw new Error('Only an election has seats.');
                }
            }
        }
    },
    // The threshold of an election, see rules.reachesThreshold in lib/voting_rules.js.
    election_rule: {
        allowNull: true,
        type: Sequelize.STRING,
        validate: {
            isIn: {
                args: [rules.ELECTION_RULES],
                msg: 'Election rule should be one of these: "absolute_majority", "half_of_votes_cast", "commission".'
            },
            matchesKind(val) {
                if (this.kind === 'election' && !isSet(val)) {
                    throw new Error('Election rule should be one of these: "absolute_majority", "half_of_votes_cast", "commission".');
                }
                if (this.kind !== 'election' && isSet(val)) {
                    throw new Error('Only an election has an election rule.');
                }
            }
        }
    },
    concerns_statutes: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        validate: {
            onlyBeforeTheAgora(val) {
                if (val && this.phase !== 'pre_agora') {
                    throw new Error('Only a Pre-Agora voting can be marked as a change of the Statutes.');
                }
            }
        }
    },
    amendment_submitted: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    antennae_total: {
        allowNull: true,
        type: Sequelize.INTEGER
    },
    quorum_required: {
        allowNull: true,
        type: Sequelize.INTEGER
    },
    antennae_voted: {
        allowNull: true,
        type: Sequelize.INTEGER
    },
    quorum_reached: {
        allowNull: true,
        type: Sequelize.BOOLEAN
    },
    outcome: {
        allowNull: true,
        type: Sequelize.STRING
    },
    outcome_reason: {
        allowNull: true,
        type: Sequelize.STRING
    },
    // The new voting on the Agora of an item that Pre-Agora Voting sent to the Agora.
    follows_voting_id: {
        allowNull: true,
        type: Sequelize.INTEGER,
        validate: {
            async isItemSentToTheAgora(val) {
                // Sequelize also runs custom validators when there is no value.
                if (val === null || typeof val === 'undefined') {
                    return;
                }

                if (this.phase !== 'agora') {
                    throw new Error('Only a voting on the Agora can follow a Pre-Agora voting.');
                }

                if (this.kind === 'election') {
                    throw new Error('An election cannot follow a Pre-Agora voting.');
                }

                const followed = Number.isInteger(val) ? await Voting.findByPk(val) : null;
                if (!followed || followed.event_id !== this.event_id || followed.phase !== 'pre_agora') {
                    throw new Error('A voting can only follow a Pre-Agora voting of the same Agora.');
                }

                if (followed.status !== 'closed' || followed.outcome !== 'to_agora') {
                    throw new Error('A voting can only follow a Pre-Agora voting that closed and sent the item to the Agora.');
                }
            }
        }
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
