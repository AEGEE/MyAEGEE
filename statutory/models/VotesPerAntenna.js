const { Sequelize, sequelize } = require('../lib/sequelize');
const MembersList = require('./MembersList');
const VotesPerDelegate = require('./VotesPerDelegate');
const Application = require('./Application');


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
}, {
    underscored: true,
    tableName: 'votes_per_antenna',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

VotesPerAntenna.recalculateVotesForAntenna = async function recalculateVotesForAntenna(body, event) {
    // Not calculating amount of votes for EPM.
    if (event.type !== 'agora') {
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
    if (memberslist && body.type === 'antenna') {
        const members = memberslist.members.length;

        if (members >= 1 && members <= 20) votesAmount = 1;
        else if (members >= 21 && members <= 50) votesAmount = 2;
        else if (members >= 51 && members <= 100) votesAmount = 3;
        else if (members >= 101 && members <= 150) votesAmount = 4;
        else if (members >= 151 && members <= 200) votesAmount = 5;
        else if (members >= 201 && members <= 250) votesAmount = 6;
        else if (members >= 251 && members <= 350) votesAmount = 7;
        else if (members >= 351 && members <= 450) votesAmount = 8;
        else if (members >= 451 && members <= 550) votesAmount = 9;
        else if (members >= 551 && members <= 650) votesAmount = 10;
        else if (members >= 651 && members <= 750) votesAmount = 11;
        else if (members >= 751 && members <= 850) votesAmount = 12;
        else if (members >= 851 && members <= 950) votesAmount = 13;
        else votesAmount = 14 + Math.floor((members - 950) / 250);
    }

    // Upsert somehow doesn't work, so we're doing it with 2 requests.
    const existingVotes = await this.findOne({
        where: {
            event_id: event.id,
            body_id: body.id
        }
    });

    if (existingVotes) {
        await existingVotes.update({ votes: votesAmount });
    } else {
        await this.create({
            event_id: event.id,
            body_id: body.id,
            votes: votesAmount
        });
    }

    // Also recalculating votes per delegate for this antenna.
    await this.recalculateVotesForDelegates(event, body.id);
};

// Recalculates how many votes each delegate has for this event based on
// how much votes this antenna has.
// Should be called in any place where the pax type/order or amount of votes has changed, so:
// - updating/setting/unsetting pax type/order
// - updating application's body (need to recalculate for both old and new body)
// - memberslist uploading/updating.
// - probably more places, TODO: investigate.
//
// We don't need the whole body there, just the body ID.
VotesPerAntenna.recalculateVotesForDelegates = async function recalculateVotesForDelegates(event, bodyId, transaction = null) {
    if (!transaction) {
        await sequelize.transaction(async (t) => {
            await this.recalculateVotesForDelegates(event, bodyId, t);
        });
        return;
    }

    const votesAmountPerAntenna = await this.findOne({
        where: {
            event_id: event.id,
            body_id: bodyId
        },
        transaction
    });

    if (!votesAmountPerAntenna) {
        return;
    }

    // 2 distributions of votes:
    // 1) off-event, where only confirmation is required
    // 2) on-event, where the votes are distributed between those who are on spot but did not leave yet
    const distributions = [
        { type: 'off-event', filter: { confirmed: true } },
        { type: 'on-event', filter: { confirmed: true, registered: true, departed: false } }
    ];

    // Removing all VotesPerDelegate for this body for this event,
    // we'll need to re-create them later anyway.
    await VotesPerDelegate.destroy({
        where: {
            event_id: event.id,
            body_id: bodyId
        },
        transaction
    });

    // Iterating through all vote distributions.
    for (const distribution of distributions) {
        // Default filter for all distribution is: select all delegates
        // for this body for this event who are not cancelled.
        const defaultFilter = {
            event_id: event.id,
            body_id: bodyId,
            participant_type: 'delegate',
            cancelled: false
        };

        // Then applying our custom filter for each distribution.
        const customFilter = Object.assign(defaultFilter, distribution.filter);

        // Then selecting all people who match this filter (as these are those people
        // between which votes would be distributed).
        const delegates = await Application.findAll({
            where: customFilter,
            order: [['participant_order', 'ASC']], // We'll need it sorted by pax order increasing.
            transaction
        });

        // If no delegates, we don't need to distribute votes (they are destroyed
        // anyway already, whatever).
        if (delegates.length === 0) {
            continue;
        }

        // Okay, so here's some hard math going on.
        // First, we calculate how much votes should go for a delegate.
        // But there can be cases when you cannot divide votes without a remainder.
        // For example, the antenna has 10 votes and 3 delegates.
        // In this approach, the delegate (1) will receive 4 votes
        // and delegate (2) and (3) will receive 3 votes each.
        // Here is the algorithm I've used:
        // https://stackoverflow.com/questions/21713631/distribute-items-in-buckets-equally-best-effort
        const delegatesAmount = delegates.length;
        const votesPerDelegate = Math.floor(votesAmountPerAntenna.votes / delegatesAmount);
        const votesLeft = votesAmountPerAntenna.votes % delegatesAmount;

        // Aaaand creating them again.
        for (let index = 0; index < delegates.length; index++) {
            // Starting with the first delegate, assigning votes.
            // Depending on the position, this delegate will get
            // either the amount of votes + 1, if there's enough votes,
            // or amount of votes, if there's not enough of them.
            // Also notice the 'type' property, it's taken from the
            // distribution type.
            const delegate = delegates[index];
            const votesForThisDelegate = (index < votesLeft) ? (votesPerDelegate + 1) : votesPerDelegate;

            await VotesPerDelegate.create({
                event_id: event.id,
                body_id: bodyId,
                user_id: delegate.user_id,
                type: distribution.type,
                application_id: delegate.id,
                votes: votesForThisDelegate
            }, { transaction });
        }
    }
};

module.exports = VotesPerAntenna;
