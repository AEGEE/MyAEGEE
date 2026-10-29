const lodash = require('lodash');

const errors = require('./errors');
const helpers = require('./helpers');
const middlewares = require('./middlewares');
const rules = require('./voting_rules');
const { sequelize } = require('./sequelize');
const {
    Event,
    Application,
    VotesPerAntenna,
    Voting,
    VotingBodyAllotment,
    VotingDelegateVote
} = require('../models');

// The fields of a voting that the JC can set. Status, result and the open/close fields
// change only through the open and close routes.
const EDITABLE_FIELDS = ['kind', 'title', 'description', 'majority'];

// A delegate can vote in a voting if, when the voting opens, the delegate is confirmed,
// registered on the event, not departed and not cancelled (the "on-event" delegates).
const PRESENT_DELEGATE_FILTER = {
    participant_type: 'delegate',
    confirmed: true,
    registered: true,
    departed: false,
    cancelled: false
};

exports.checkIfAgora = async (req, res, next) => {
    if (req.event.type !== 'agora') {
        return errors.makeBadRequestError(res, 'Votings are only available for Agora.');
    }

    return next();
};

exports.findVoting = async (req, res, next) => {
    if (!helpers.isNumber(req.params.voting_id)) {
        return errors.makeBadRequestError(res, 'The voting ID is invalid.');
    }

    const voting = await Voting.findOne({
        where: { id: Number(req.params.voting_id), event_id: req.event.id }
    });

    if (!voting || (voting.status === 'draft' && !req.permissions.manage_votings)) {
        return errors.makeNotFoundError(res, 'Voting is not found.');
    }

    req.voting = voting;
    return next();
};

exports.listVotings = async (req, res) => {
    const where = { event_id: req.event.id };
    if (!req.permissions.manage_votings) {
        where.status = ['open', 'closed'];
    }

    const votings = await Voting.findAll({
        where,
        order: [['created_at', 'ASC'], ['id', 'ASC']]
    });

    return res.json({
        success: true,
        data: votings
    });
};

exports.getVoting = async (req, res) => {
    return res.json({
        success: true,
        data: req.voting
    });
};

exports.createVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const voting = await Voting.create({
        ...lodash.pick(req.body, EDITABLE_FIELDS),
        event_id: req.event.id
    });

    return res.json({
        success: true,
        data: voting
    });
};

exports.editVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    if (req.voting.status !== 'draft') {
        return errors.makeConflictError(res, 'Only a draft voting can be edited.');
    }

    await req.voting.update(lodash.pick(req.body, EDITABLE_FIELDS));

    return res.json({
        success: true,
        data: req.voting
    });
};

exports.deleteVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    if (req.voting.status !== 'draft') {
        return errors.makeConflictError(res, 'Only a draft voting can be deleted.');
    }

    await req.voting.destroy();

    return res.json({
        success: true,
        message: 'Voting is deleted.'
    });
};

// Opening a voting takes a snapshot, in one transaction, of who can vote and how much:
// one row per body with the votes of the body (copied from votes_per_antenna) and
// one row per present delegate with the most votes this delegate can cast.
// The open voting keeps this copy; later changes to members lists or delegates
// only count for votings that open later.
exports.openVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const voting = await sequelize.transaction(async (transaction) => {
        // Locking the voting, so two JC members who open it at the same time cannot both take a snapshot.
        const lockedVoting = await Voting.findByPk(req.voting.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (lockedVoting.status !== 'draft') {
            return null;
        }

        const delegates = await Application.findAll({
            where: { event_id: req.event.id, ...PRESENT_DELEGATE_FILTER },
            order: [['body_id', 'ASC'], ['participant_order', 'ASC'], ['id', 'ASC']],
            transaction
        });

        const votesPerBody = await VotesPerAntenna.findAll({
            where: { event_id: req.event.id },
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
                voting_id: lockedVoting.id,
                body_id: bodyId,
                votes_total: votesTotal,
                min_votes: split.min_votes,
                extra_votes: split.extra_votes
            });

            for (const delegate of bodyDelegates) {
                delegateVotes.push({
                    voting_id: lockedVoting.id,
                    application_id: delegate.id,
                    user_id: delegate.user_id,
                    body_id: bodyId,
                    max_votes: split.max_votes
                });
            }
        }

        await VotingBodyAllotment.bulkCreate(bodyAllotments, { transaction });
        await VotingDelegateVote.bulkCreate(delegateVotes, { transaction });

        await lockedVoting.update({
            status: 'open',
            opened_at: new Date(),
            opened_by: req.user.id
        }, { transaction });

        return lockedVoting;
    });

    if (!voting) {
        return errors.makeConflictError(res, 'Only a draft voting can be opened.');
    }

    return res.json({
        success: true,
        data: voting
    });
};

// Counts the votes of a voting: the tally in total, and per body who voted and how many votes.
// The tally (in favour, against, abstention) is only shown once the voting is closed;
// while it is open, only the progress per body and delegate is shown.
const countVotes = async (voting, transaction) => {
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

    const bodies = bodyAllotments.map((bodyAllotment) => {
        const bodyDelegateVotes = delegateVotes.filter((delegateVote) => delegateVote.body_id === bodyAllotment.body_id);

        return {
            body_id: bodyAllotment.body_id,
            votes_total: bodyAllotment.votes_total,
            votes_cast: bodyAllotment.votes_cast,
            delegates_count: bodyDelegateVotes.length,
            delegates_voted: bodyDelegateVotes.filter((delegateVote) => delegateVote.submitted_at).length,
            delegates: bodyDelegateVotes.map((delegateVote) => ({
                application_id: delegateVote.application_id,
                user_id: delegateVote.user_id,
                voted: delegateVote.submitted_at !== null
            }))
        };
    });

    const sum = (field) => delegateVotes.reduce((acc, delegateVote) => acc + delegateVote[field], 0);
    const tally = {
        in_favour: sum('in_favour'),
        against: sum('against'),
        abstention: sum('abstention')
    };

    const progress = {
        votes_total: bodies.reduce((acc, body) => acc + body.votes_total, 0),
        votes_cast: bodies.reduce((acc, body) => acc + body.votes_cast, 0),
        bodies_available: bodies.length,
        bodies_present: bodies.filter((body) => body.votes_cast > 0).length
    };
    progress.votes_cast_percentage = rules.percentage(progress.votes_cast, progress.votes_total);

    return { tally, progress, bodies };
};

exports.closeVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const voting = await sequelize.transaction(async (transaction) => {
        // Locking the voting waits for votes that are being stored right now
        // (each vote holds a share lock on the voting) and blocks new ones, so the count is final.
        const lockedVoting = await Voting.findByPk(req.voting.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (lockedVoting.status !== 'open') {
            return null;
        }

        const { tally } = await countVotes(lockedVoting, transaction);

        await lockedVoting.update({
            status: 'closed',
            result: rules.isAccepted(lockedVoting.majority, tally) ? 'accepted' : 'rejected',
            closed_at: new Date(),
            closed_by: req.user.id
        }, { transaction });

        return lockedVoting;
    });

    if (!voting) {
        return errors.makeConflictError(res, 'Only an open voting can be closed.');
    }

    return res.json({
        success: true,
        data: voting
    });
};

// Who voted so far, per body and delegate, without what they voted.
exports.getProgress = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot see the progress of this voting.');
    }

    if (req.voting.status === 'draft') {
        return errors.makeConflictError(res, 'This voting is not open yet.');
    }

    const { progress, bodies } = await countVotes(req.voting);

    return res.json({
        success: true,
        data: {
            voting: req.voting,
            ...progress,
            bodies
        }
    });
};

// The count with the majority, only once the voting is closed. Everyone can see it then.
exports.getResult = async (req, res) => {
    if (req.voting.status !== 'closed') {
        return errors.makeConflictError(res, 'The result is only known once the voting is closed.');
    }

    const { tally, progress } = await countVotes(req.voting);

    return res.json({
        success: true,
        data: {
            voting: req.voting,
            majority: req.voting.majority,
            result: req.voting.result,
            ...tally,
            ...progress
        }
    });
};

// The vote route does not use fetchEvent: it only needs the voting and the row of the
// delegate in the snapshot, so it asks core only who the user is (see middlewares.authenticateMember).
exports.findVotingForMember = async (req, res, next) => {
    if (!helpers.isNumber(req.params.voting_id)) {
        return errors.makeBadRequestError(res, 'The voting ID is invalid.');
    }

    let eventId = Number(req.params.event_id);
    if (!helpers.isNumber(req.params.event_id)) {
        const event = await Event.findOne(middlewares.getEventQuery(req.params.event_id));
        if (!event) {
            return errors.makeNotFoundError(res, 'Event with such url or ID is not found.');
        }
        eventId = event.id;
    }

    const voting = await Voting.findOne({
        where: { id: Number(req.params.voting_id), event_id: eventId }
    });
    if (!voting || voting.status === 'draft') {
        return errors.makeNotFoundError(res, 'Voting is not found.');
    }

    const delegateVote = await VotingDelegateVote.findOne({
        where: { voting_id: voting.id, user_id: req.user.id }
    });
    if (!delegateVote) {
        return errors.makeForbiddenError(res, 'You have no votes in this voting: you were not a present delegate when it opened.');
    }

    req.voting = voting;
    req.delegateVote = delegateVote;
    return next();
};

const formatMyVote = (voting, delegateVote, bodyAllotment) => ({
    voting: helpers.whitelistObject(voting.toJSON(), ['id', 'event_id', 'kind', 'title', 'description', 'majority', 'status']),
    body_id: delegateVote.body_id,
    max_votes: delegateVote.max_votes,
    votes_available: voting.status === 'open' ? rules.votesAvailable(bodyAllotment, delegateVote) : 0,
    in_favour: delegateVote.in_favour,
    against: delegateVote.against,
    abstention: delegateVote.abstention,
    submitted_at: delegateVote.submitted_at
});

const findBodyAllotment = (delegateVote) => VotingBodyAllotment.findOne({
    where: { voting_id: delegateVote.voting_id, body_id: delegateVote.body_id }
});

exports.getMyVote = async (req, res) => {
    const bodyAllotment = await findBodyAllotment(req.delegateVote);

    return res.json({
        success: true,
        data: formatMyVote(req.voting, req.delegateVote, bodyAllotment)
    });
};

const VOTE_FIELDS = ['in_favour', 'against', 'abstention'];

// How each refusal of the database (named after its constraint) is told to the delegate.
const VOTE_REFUSALS = {
    already_voted: (res) => errors.makeConflictError(res, 'You have already voted in this voting.'),
    voting_not_open: (res) => errors.makeConflictError(res, 'This voting is not open.'),
    delegate_not_present: (res) => errors.makeForbiddenError(res, 'You cannot vote: you are not a present delegate any more (departed or cancelled).'),
    body_vote_limit: (res, body) => errors.makeConflictError(
        res,
        `Your body has only ${body.votes_total - body.votes_cast} of its ${body.votes_total} votes left.`
    ),
    extra_vote_limit: (res, body, delegateVote) => errors.makeConflictError(
        res,
        `The extra votes of your body are already used by other delegates, you can cast at most ${rules.votesAvailable(body, delegateVote)} votes.`
    )
};

exports.submitMyVote = async (req, res) => {
    const counts = {};
    for (const field of VOTE_FIELDS) {
        const value = helpers.isDefined(req.body[field]) ? req.body[field] : 0;
        if (!Number.isInteger(value) || value < 0) {
            return errors.makeValidationError(res, `The amount of votes "${field}" should be a whole number, 0 or more.`);
        }
        counts[field] = value;
    }

    const total = counts.in_favour + counts.against + counts.abstention;
    if (total < 1) {
        return errors.makeValidationError(res, 'You should cast at least one vote.');
    }

    if (total > req.delegateVote.max_votes) {
        return errors.makeValidationError(res, `You can cast at most ${req.delegateVote.max_votes} votes.`);
    }

    // One statement. The trigger count_delegate_votes and the constraints in the database decide
    // whether the vote is valid, under a lock per body, so votes sent at the same moment
    // can never together break the limit of the body or the division rule.
    let updatedRows;
    try {
        [, updatedRows] = await VotingDelegateVote.update(counts, {
            where: { voting_id: req.delegateVote.voting_id, application_id: req.delegateVote.application_id },
            returning: true
        });
    } catch (err) {
        const refusal = err.parent && VOTE_REFUSALS[err.parent.constraint];
        if (!refusal) {
            throw err;
        }

        const bodyAllotment = await findBodyAllotment(req.delegateVote);
        return refusal(res, bodyAllotment, req.delegateVote);
    }

    const bodyAllotment = await findBodyAllotment(req.delegateVote);
    return res.json({
        success: true,
        data: formatMyVote(req.voting, updatedRows[0], bodyAllotment)
    });
};
