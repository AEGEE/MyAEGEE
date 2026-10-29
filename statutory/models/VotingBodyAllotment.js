const { Sequelize, sequelize } = require('../lib/sequelize');

// The votes of one body in one voting, copied when the voting opens.
// votes_cast and delegates_above_min are counters that only the database trigger
// count_delegate_votes changes; the CHECK constraints on this table enforce the body limit
// and the extra-vote limit (see the migration that creates this table).
const VotingBodyAllotment = sequelize.define('VotingBodyAllotment', {
    voting_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER
    },
    body_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER
    },
    votes_total: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    min_votes: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    extra_votes: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    votes_cast: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    delegates_above_min: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0
    }
}, {
    underscored: true,
    tableName: 'voting_body_allotments',
    timestamps: false
});

module.exports = VotingBodyAllotment;
