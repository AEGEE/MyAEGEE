const { Sequelize, sequelize } = require('../lib/sequelize');

// One candidate on the ballot of one election. The JC chooses the candidates while the election
// is scheduled; when it opens, label gets the current name of the candidature and the ballot is fixed
// (trigger guard_voting_options). Closing sets the outcome: elected, not_elected, or tie for the last seat.
const VotingOption = sequelize.define('VotingOption', {
    voting_id: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    candidate_id: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    label: {
        allowNull: false,
        type: Sequelize.TEXT
    },
    ballot_order: {
        allowNull: false,
        type: Sequelize.INTEGER
    },
    outcome: {
        allowNull: true,
        type: Sequelize.STRING
    }
}, {
    underscored: true,
    tableName: 'voting_options',
    timestamps: false
});

module.exports = VotingOption;
