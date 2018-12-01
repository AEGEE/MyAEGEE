const { Sequelize, sequelize } = require('../lib/sequelize');
const MembersList = require('./MembersList');

const VotesPerAntenna = sequelize.define('VotesPerAntenna', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event ID should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body ID should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        },
    },
    votes: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Votes per antenna should be set.' },
            isNumeric: { msg: 'Votes per antenna should be valid.' },
            min: { args: [0], msg: 'Votes per antenna cannot be negative' }
        }
    }
}, { underscored: true, tableName: 'votes_per_antenna' });

VotesPerAntenna.recalculateVotesForAntenna = async function recalculateVotesForAntenna(body, event) {
    // Not calculating amount of votes for EPM.
    if (event.type !== 'agora') {
        return;
    }

    // Also, only antenna can vote.
    if (body.type !== 'antenna') {
        return;
    }

    let votesAmount = 0;

    // Finding memberslist for this Agora for this body.
    const memberslist = await MembersList.findOne({ where: {
        event_id: event.id,
        body_id: body.id
    } });

    // If no memberslist is provided, no votes.
    // Otherwise, calculating amount of votes based on CIA.
    //
    // Article 17: Ordinary Agora
    // (1) 2The ordinary Agora meets twice a year.

    // (2) 1The required quorum for an election is 50% of the members of AEGEE-Europe.

    // (3) 1Every local sends at least one and at most three delegates, elected in the local Agora.
    // 2The number of votes per AEGEE Antenna depends directly on the membership fees paid to AEGEE-Europe.
    // 3The number of votes is distributed in the following way:
    // 410 - 20 members  1 vote;
    // 21- 50 members 2 votes;
    // 51- 100 members 3 votes;
    // 101- 150 members 4 votes;
    // 151- 200 members 5 votes;
    // 201- 250 members 6 votes;
    // 251- 350 members 7 votes;
    // 351- 450 members 8 votes;
    // 451- 550 members 9 votes;
    // 551- 650 members 10 votes;
    // 651- 750 members 11 votes;
    // 751- 850 members 12 votes;
    // 851- 950 members 13 votes;
    // from 951 members 14 votes plus one additional vote for every 250 additional members.
    if (memberslist) {
        const members = memberslist.members.length;

        if (members >= 10 && members <= 20) votesAmount = 1;
        else if (members >= 21 && members <= 50) votesAmount = 2;
        else if (members >= 51 && members <= 100) votesAmount = 3;
        else if (members >= 101 && members <= 150) votesAmount = 4;
        else if (members >= 151 && members <= 120) votesAmount = 5;
        else if (members >= 201 && members <= 250) votesAmount = 6;
        else if (members >= 251 && members <= 350) votesAmount = 7;
        else if (members >= 351 && members <= 450) votesAmount = 8;
        else if (members >= 451 && members <= 550) votesAmount = 9;
        else if (members >= 551 && members <= 650) votesAmount = 10;
        else if (members >= 651 && members <= 750) votesAmount = 11
        else if (members >= 751 && members <= 850) votesAmount = 12;
        else if (members >= 851 && members <= 950) votesAmount = 13;
        else if (members >= 951) votesAmount = 14 + Math.floor((members - 950) / 250);
    }

    return this.upsert({
        event_id: event.id,
        body_id: body.id,
        votes: votesAmount
    });
}

module.exports = VotesPerAntenna;