const lodash = require('lodash');

const errors = require('./errors');
const helpers = require('./helpers');
const middlewares = require('./middlewares');
const rules = require('./voting_rules');
const lifecycle = require('./voting_lifecycle');
const { sequelize } = require('./sequelize');
const {
    Event,
    Voting,
    VotingBodyAllotment,
    VotingDelegateVote
} = require('../models');

// The fields of a voting that the JC can set. Status, result and the open, close and publish
// fields change only through the voting lifecycle and the publish route.
const EDITABLE_FIELDS = ['kind', 'title', 'description', 'majority', 'opens_at', 'closes_at'];

// Until the JC publishes the result, only the JC sees whether a voting was accepted.
const formatVoting = (voting, canManage) => {
    const json = voting.toJSON();
    if (!canManage && !voting.published) {
        json.result = null;
    }
    return json;
};

// The JC can only change a voting that did not open yet. Locking the voting waits for an opening
// that runs right now (lib/voting_lifecycle.js locks it too), so an edit never reaches an open voting.
// Returns the locked voting, or null if it opened or is due to open.
const lockScheduledVoting = async (votingId, transaction) => {
    const voting = await Voting.findByPk(votingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!voting || voting.status !== 'scheduled' || new Date(voting.opens_at).getTime() <= Date.now()) {
        return null;
    }
    return voting;
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

    let voting = await Voting.findOne({
        where: { id: Number(req.params.voting_id), event_id: req.event.id }
    });
    if (voting) {
        voting = await lifecycle.syncVoting(voting);
    }

    if (!voting || (voting.status === 'scheduled' && !req.permissions.manage_votings)) {
        return errors.makeNotFoundError(res, 'Voting is not found.');
    }

    req.voting = voting;
    return next();
};

exports.listVotings = async (req, res) => {
    const found = await Voting.findAll({
        where: { event_id: req.event.id },
        order: [['opens_at', 'ASC'], ['id', 'ASC']]
    });

    const votings = [];
    for (const voting of found) {
        votings.push(await lifecycle.syncVoting(voting));
    }

    return res.json({
        success: true,
        data: votings
            .filter((voting) => req.permissions.manage_votings || voting.status !== 'scheduled')
            .map((voting) => formatVoting(voting, req.permissions.manage_votings))
    });
};

exports.getVoting = async (req, res) => {
    return res.json({
        success: true,
        data: formatVoting(req.voting, req.permissions.manage_votings)
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
        data: await lifecycle.syncVoting(voting)
    });
};

exports.editVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const voting = await sequelize.transaction(async (transaction) => {
        const locked = await lockScheduledVoting(req.voting.id, transaction);
        if (locked) {
            await locked.update(lodash.pick(req.body, EDITABLE_FIELDS), { fields: EDITABLE_FIELDS, transaction });
        }
        return locked;
    });

    if (!voting) {
        return errors.makeConflictError(res, 'Only a voting that did not open yet can be edited.');
    }

    return res.json({
        success: true,
        data: await lifecycle.syncVoting(voting)
    });
};

exports.deleteVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const deleted = await sequelize.transaction(async (transaction) => {
        const locked = await lockScheduledVoting(req.voting.id, transaction);
        if (locked) {
            await locked.destroy({ transaction });
        }
        return locked !== null;
    });

    if (!deleted) {
        return errors.makeConflictError(res, 'Only a voting that did not open yet can be deleted.');
    }

    return res.json({
        success: true,
        message: 'Voting is deleted.'
    });
};

// After the voting closed, the JC publishes the result. From then on every logged-in user
// sees the result, as in the old OMS JC module.
exports.publishVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    if (req.voting.status !== 'closed') {
        return errors.makeConflictError(res, 'Only a closed voting can be published.');
    }

    if (!req.voting.published) {
        await req.voting.update({ published: true, published_at: new Date(), published_by: req.user.id });
    }

    return res.json({
        success: true,
        data: formatVoting(req.voting, true)
    });
};

// Who voted so far, per body and delegate, and how many votes are cast,
// but not what they voted.
exports.getProgress = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot see the progress of this voting.');
    }

    if (req.voting.status === 'scheduled') {
        return errors.makeConflictError(res, 'This voting is not open yet.');
    }

    const { progress, bodies } = await lifecycle.countVotes(req.voting);

    return res.json({
        success: true,
        data: {
            voting: formatVoting(req.voting, true),
            ...progress,
            bodies: bodies.map((body) => lodash.omit(body, ['in_favour', 'against', 'abstention']))
        }
    });
};

// The result, as the old OMS JC module showed it: the totals with percentages and a table
// with the votes of each body that voted. The JC sees it once the voting is closed;
// every other logged-in user once the JC published it.
exports.getResult = async (req, res) => {
    if (req.voting.status !== 'closed') {
        return errors.makeConflictError(res, 'The result is only known once the voting is closed.');
    }

    if (!req.voting.published && !req.permissions.manage_votings) {
        return errors.makeConflictError(res, 'The result of this voting is not published yet.');
    }

    const { tally, progress, bodies } = await lifecycle.countVotes(req.voting);
    const votesCast = tally.in_favour + tally.against + tally.abstention;

    return res.json({
        success: true,
        data: {
            voting: formatVoting(req.voting, true),
            majority: req.voting.majority,
            result: req.voting.result,
            published: req.voting.published,
            ...tally,
            in_favour_percentage: rules.percentage(tally.in_favour, votesCast),
            against_percentage: rules.percentage(tally.against, votesCast),
            abstention_percentage: rules.percentage(tally.abstention, votesCast),
            ...progress,
            bodies_present_percentage: rules.percentage(progress.bodies_present, progress.bodies_available),
            bodies: bodies
                .filter((body) => body.votes_cast > 0)
                .map((body) => lodash.pick(body, ['body_id', 'votes_total', 'votes_cast', 'in_favour', 'against', 'abstention']))
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

    let voting = await Voting.findOne({
        where: { id: Number(req.params.voting_id), event_id: eventId }
    });
    if (voting) {
        voting = await lifecycle.syncVoting(voting);
    }
    if (!voting || voting.status === 'scheduled') {
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

const findBodyAllotment = (delegateVote) => VotingBodyAllotment.findOne({
    where: { voting_id: delegateVote.voting_id, body_id: delegateVote.body_id }
});

// What a delegate sees, as in the old OMS JC module: the own vote, and for the own body
// how many votes and delegates it has and how many votes it cast (not what the others voted).
const formatMyVote = async (voting, delegateVote) => {
    const bodyAllotment = await findBodyAllotment(delegateVote);
    const delegatesCount = await VotingDelegateVote.count({
        where: { voting_id: delegateVote.voting_id, body_id: delegateVote.body_id }
    });

    return {
        voting: helpers.whitelistObject(voting.toJSON(), ['id', 'event_id', 'kind', 'title', 'description', 'majority', 'opens_at', 'closes_at', 'status']),
        body: {
            body_id: bodyAllotment.body_id,
            votes_total: bodyAllotment.votes_total,
            delegates_count: delegatesCount,
            votes_cast: bodyAllotment.votes_cast
        },
        body_id: delegateVote.body_id,
        max_votes: delegateVote.max_votes,
        votes_available: voting.status === 'open' ? rules.votesAvailable(bodyAllotment, delegateVote) : 0,
        in_favour: delegateVote.in_favour,
        against: delegateVote.against,
        abstention: delegateVote.abstention,
        submitted_at: delegateVote.submitted_at
    };
};

exports.getMyVote = async (req, res) => {
    return res.json({
        success: true,
        data: await formatMyVote(req.voting, req.delegateVote)
    });
};

const VOTE_FIELDS = ['in_favour', 'against', 'abstention'];

// How each refusal of the database (named after its constraint) is told to the delegate.
const VOTE_REFUSALS = {
    already_voted: (res) => errors.makeConflictError(res, 'You have already voted in this voting.'),
    voting_not_open: (res) => errors.makeConflictError(res, 'This voting is closed.'),
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

    return res.json({
        success: true,
        data: await formatMyVote(req.voting, updatedRows[0])
    });
};
