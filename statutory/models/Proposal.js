const { Sequelize, sequelize } = require('../lib/sequelize');

// A proposal is an item on the agenda of an Agora. Its proposer submits it with a title, the names of
// the proposers (free text, as in OMS), the part of the CIA it changes and a link to its text and
// motivation; the text itself stays outside MyAEGEE. The JC puts it on the agenda or does not admit it
// with a reason (Working Format of the Agora, Art. 8(2)); the proposer can withdraw it.
// A voting of kind 'proposal' points to it (votings.proposal_id), and the decision of the Agora is a
// checked copy of the voting that decided it. The database keeps these rules (trigger proposal_guard),
// see migrations/20261102120000-add-proposals.js and lib/proposals.js.
const Proposal = sequelize.define('proposal', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    title: {
        allowNull: false,
        type: Sequelize.TEXT,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'The title of the proposal should be set.' }
        }
    },
    proposers: {
        allowNull: false,
        type: Sequelize.TEXT,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'The proposers should be set, for example "A. Example on behalf of AEGEE-Atlantis".' }
        }
    },
    // The part of the CIA that the proposal changes; it gives the majority of a voting on it.
    cia_part: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            isIn: {
                args: [['statutes', 'working_format', 'other']],
                msg: 'The part of the CIA should be one of these: "statutes", "working_format", "other".'
            }
        }
    },
    text_url: {
        allowNull: false,
        type: Sequelize.TEXT,
        defaultValue: '',
        validate: {
            is: {
                args: /^https?:\/\//,
                msg: 'The link to the text should be a web address that starts with http:// or https://.'
            }
        }
    },
    created_by: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    status: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'submitted',
        validate: {
            isIn: {
                args: [['submitted', 'on_agenda', 'not_admitted', 'withdrawn']],
                msg: 'The status should be one of these: "submitted", "on_agenda", "not_admitted", "withdrawn".'
            }
        }
    },
    jc_reason: {
        allowNull: true,
        type: Sequelize.TEXT
    },
    // When the JC put it on the agenda, set by the database. A withdrawn proposal with it stays visible to everyone.
    on_agenda_at: {
        allowNull: true,
        type: Sequelize.DATE
    },
    decision: {
        allowNull: true,
        type: Sequelize.STRING
    },
    decided_by_voting_id: {
        allowNull: true,
        type: Sequelize.INTEGER
    },
    decided_at: {
        allowNull: true,
        type: Sequelize.DATE
    }
}, {
    underscored: true,
    tableName: 'proposals',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Proposal;
