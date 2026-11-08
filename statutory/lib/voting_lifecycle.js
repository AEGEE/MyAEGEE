const logger = require('./logger');
const rules = require('./voting_rules');
const { sequelize } = require('./sequelize');
const {
    Application,
    VotesPerAntenna,
    Voting,
    VotingBodyAllotment,
    VotingDelegateVote
} = require('../models');

// A voting opens and closes by itself, on time:
// - scheduled until opens_at; at opens_at it takes the snapshot and becomes open;
// - open until closes_at; at closes_at it counts the votes, stores the result and becomes closed.
// Two things move a voting on, so that a missed job breaks nothing:
// a job per voting in lib/cron.js, and syncVoting() on every request that reads a voting.
// The database itself refuses votes after closes_at (trigger count_delegate_votes).

// A delegate can vote in a voting if, when the voting opens, the delegate is confirmed,
// registered on the event, not departed and not cancelled (the "on-event" delegates).
const PRESENT_DELEGATE_FILTER = {
    participant_type: 'delegate',
    confirmed: true,
    registered: true,
    departed: false,
    cancelled: false
};

const isDue = (time) => new Date(time).getTime() <= Date.now();

// The snapshot: one row per body with the votes of the body (copied from votes_per_antenna)
// and one row per present delegate with the most votes this delegate can cast.
// The open voting keeps this copy; later changes to members lists or delegates
// only count for votings that open later.
const takeSnapshot = async (voting, transaction) => {
    const delegates = await Application.findAll({
        where: { event_id: voting.event_id, ...PRESENT_DELEGATE_FILTER },
        order: [['body_id', 'ASC'], ['participant_order', 'ASC'], ['id', 'ASC']],
        transaction
    });

    const votesPerBody = await VotesPerAntenna.findAll({
        where: { event_id: voting.event_id },
        transaction
    });

    const delegatesPerBody = new Map();
    for (const delegate of delegates) {
        if (!delegatesPerBody.has(delegate.body_id)) delegatesPerBody.set(delegate.body_id, []);
        delegatesPerBody.get(delegate.body_id).push(delegate);
    }

    const bodyAllotments = [];
    const delegateVotes = [];
    for (const [bodyId, bodyDelegates] of delegatesPerBody) {
        const bodyVotes = votesPerBody.find((votes) => votes.body_id === bodyId);
        const votesTotal = bodyVotes ? bodyVotes.votes : 0;
        const split = rules.splitVotes(votesTotal, bodyDelegates.length);

        bodyAllotments.push({
            voting_id: voting.id,
            body_id: bodyId,
            votes_total: votesTotal,
            min_votes: split.min_votes,
            extra_votes: split.extra_votes
        });

        for (const delegate of bodyDelegates) {
            delegateVotes.push({
                voting_id: voting.id,
                application_id: delegate.id,
                user_id: delegate.user_id,
                body_id: bodyId,
                max_votes: split.max_votes
            });
        }
    }

    await VotingBodyAllotment.bulkCreate(bodyAllotments, { transaction });
    await VotingDelegateVote.bulkCreate(delegateVotes, { transaction });
};

// Counts the votes of a voting: the tally in total and per body, and who voted.
exports.countVotes = async (voting, transaction) => {
    const bodyAllotments = await VotingBodyAllotment.findAll({
        where: { voting_id: voting.id },
        order: [['body_id', 'ASC']],
        transaction
    });

    const delegateVotes = await VotingDelegateVote.findAll({
        where: { voting_id: voting.id },
        order: [['body_id', 'ASC'], ['application_id', 'ASC']],
        transaction
    });

    const sum = (rows, field) => rows.reduce((acc, row) => acc + row[field], 0);

    const bodies = bodyAllotments.map((bodyAllotment) => {
        const bodyDelegateVotes = delegateVotes.filter((delegateVote) => delegateVote.body_id === bodyAllotment.body_id);

        return {
            body_id: bodyAllotment.body_id,
            votes_total: bodyAllotment.votes_total,
            votes_cast: bodyAllotment.votes_cast,
            in_favour: sum(bodyDelegateVotes, 'in_favour'),
            against: sum(bodyDelegateVotes, 'against'),
            abstention: sum(bodyDelegateVotes, 'abstention'),
            delegates_count: bodyDelegateVotes.length,
            delegates_voted: bodyDelegateVotes.filter((delegateVote) => delegateVote.submitted_at).length,
            delegates: bodyDelegateVotes.map((delegateVote) => ({
                application_id: delegateVote.application_id,
                user_id: delegateVote.user_id,
                voted: delegateVote.submitted_at !== null
            }))
        };
    });

    const tally = {
        in_favour: sum(delegateVotes, 'in_favour'),
        against: sum(delegateVotes, 'against'),
        abstention: sum(delegateVotes, 'abstention')
    };

    const progress = {
        votes_total: sum(bodies, 'votes_total'),
        votes_cast: sum(bodies, 'votes_cast'),
        bodies_available: bodies.length,
        bodies_present: bodies.filter((body) => body.votes_cast > 0).length
    };
    progress.votes_cast_percentage = rules.percentage(progress.votes_cast, progress.votes_total);

    return { tally, progress, bodies };
};

// Opens the voting if it is scheduled and opens_at has come. Locking the voting makes sure
// that only one snapshot is taken, also when a job and requests come at the same moment.
const openIfDue = async (votingId) => sequelize.transaction(async (transaction) => {
    const voting = await Voting.findByPk(votingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!voting || voting.status !== 'scheduled' || !isDue(voting.opens_at)) {
        return;
    }

    await takeSnapshot(voting, transaction);
    await voting.update({ status: 'open', opened_at: new Date() }, { transaction });
    logger.info({ voting: voting.id }, 'Opened voting');
});

// Closes the voting if it is open and closes_at has come. Locking the voting waits for votes
// that are being stored right now (each vote holds a share lock on the voting), so the count is final.
const closeIfDue = async (votingId) => sequelize.transaction(async (transaction) => {
    const voting = await Voting.findByPk(votingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!voting || voting.status !== 'open' || !isDue(voting.closes_at)) {
        return;
    }

    const { tally } = await exports.countVotes(voting, transaction);
    await voting.update({
        status: 'closed',
        result: rules.isAccepted(voting.majority, tally) ? 'accepted' : 'rejected',
        closed_at: new Date()
    }, { transaction });
    logger.info({ voting: voting.id }, 'Closed voting');
});

// Moves the voting on to the status that its time window asks for, and returns it fresh.
// Does nothing (and no query) when the voting is already in the right status.
// A voting whose whole window passed while nothing ran is opened and closed at once.
exports.syncVoting = async (voting) => {
    const opening = voting.status === 'scheduled' && isDue(voting.opens_at);
    const closing = voting.status !== 'closed' && isDue(voting.closes_at);
    if (!opening && !closing) {
        return voting;
    }

    await openIfDue(voting.id);
    await closeIfDue(voting.id);
    return voting.reload();
};

exports.syncVotingById = async (votingId) => {
    const voting = await Voting.findByPk(votingId);
    if (!voting) {
        logger.warn({ id: votingId }, 'Syncing voting: voting is not found.');
        return null;
    }

    return exports.syncVoting(voting);
};

// A scheduler can fire a little before the planned time. Then this waits for that time
// and tries again, so a voting does not stay scheduled or open until the next request.
const EARLY_TICK_MS = 1000;

exports.runScheduledSync = async (votingId) => {
    const voting = await exports.syncVotingById(votingId);
    if (!voting || voting.status === 'closed') {
        return;
    }

    const nextTime = voting.status === 'scheduled' ? voting.opens_at : voting.closes_at;
    const wait = new Date(nextTime).getTime() - Date.now();
    if (wait > 0 && wait <= EARLY_TICK_MS) {
        await new Promise((resolve) => { setTimeout(resolve, wait); });
        await exports.syncVotingById(votingId);
    }
};

// On start of the server: moves on every voting that is due, and schedules the others.
exports.registerAllVotings = async () => {
    const votings = await Voting.findAll({ where: { status: ['scheduled', 'open'] } });
    logger.info({ count: votings.length }, 'Registering deadlines for votings...');
    for (const voting of votings) {
        const synced = await exports.syncVoting(voting);
        if (synced.status !== 'closed') {
            // Triggering model update to run hooks to set deadlines.
            synced.changed('id', true);
            await synced.save();
        }
    }
};
