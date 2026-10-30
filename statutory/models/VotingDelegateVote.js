const { Sequelize, sequelize } = require('../lib/sequelize');

// One row per delegate who could vote when the voting opened.
// The delegate fills in in_favour, against and abstention once, or in an election ballots_cast:
// the number of ballots, never what is on them (see lib/ballot_box.js). The database trigger
// count_delegate_votes then sets submitted_at and updates the counters of the body.
const VotingDelegateVote = sequelize.define('VotingDelegateVote', {
    voting_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER
    },
    application_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER
    },
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    max_votes: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    in_favour: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    against: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    abstention: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    ballots_cast: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    submitted_at: {
        allowNull: true,
        type: Sequelize.DATE
    }
}, {
    underscored: true,
    tableName: 'voting_delegate_votes',
    timestamps: false
});

module.exports = VotingDelegateVote;
