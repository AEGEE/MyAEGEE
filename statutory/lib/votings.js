const lodash = require('lodash');

const ballotBox = require('./ballot_box');
const elections = require('./elections');
const errors = require('./errors');
const helpers = require('./helpers');
const logger = require('./logger');
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
// fields change only through the voting lifecycle and the publish route; the quorum and the
// outcome of a Pre-Agora voting only through the lifecycle and the amendment route.
// The candidates on the ballot of an election come in the separate field "candidates".
const EDITABLE_FIELDS = [
    'kind',
    'title',
    'description',
    'majority',
    'opens_at',
    'closes_at',
    'phase',
    'concerns_statutes',
    'follows_voting_id',
    'position_id',
    'seats',
    'election_rule'
];

const PHASES = ['agora', 'pre_agora'];

// The fields that tell how a voting went. Until the result is published, only the JC sees them.
// A Pre-Agora voting is published at closing, so for it they are public as soon as they are known.
const RESULT_FIELDS = ['result', 'antennae_voted', 'quorum_reached', 'outcome', 'outcome_reason'];

const formatVoting = (voting, canManage) => {
    const json = voting.toJSON();
    if (!canManage && !voting.published) {
        for (const field of RESULT_FIELDS) {
            json[field] = null;
        }
    }
    return json;
};

// One voting as the API shows it; an election also with the candidates on its ballot.
const presentVoting = async (voting, canManage) => {
    const json = formatVoting(voting, canManage);
    if (voting.kind !== 'election') {
        return json;
    }

    return { ...json, ...(await elections.formatBallot(voting, canManage)) };
};

const KIND_CHANGE_MESSAGE = 'An election cannot become another kind of voting, or the other way round: delete it and create a new one.';
const POSITION_MESSAGE = 'The position should be a position of this Agora.';
const LATE_ELECTION_MESSAGE = 'This election did not open on time: set a new opens_at and closes_at in the future.';

const isInFuture = (time) => new Date(time).getTime() > Date.now();

// A Pre-Agora voting always has a two-thirds majority (Art. 20(3)), so the JC does not have to give it.
// An election has no majority and cannot be in Pre-Agora Voting, so it gets none.
// currentPhase and currentKind are the phase and the kind of the voting before this change.
const withPreAgoraMajority = (fields, currentPhase, currentKind) => {
    const phase = helpers.isDefined(fields.phase) ? fields.phase : currentPhase;
    const kind = helpers.isDefined(fields.kind) ? fields.kind : currentKind;
    if (phase === 'pre_agora' && kind !== 'election' && !helpers.isDefined(fields.majority)) {
        return { ...fields, majority: 'two_thirds' };
    }
    return fields;
};

// The JC can only change a voting that did not open yet. Locking the voting waits for an opening
// that runs right now (lib/voting_lifecycle.js locks it too), so an edit never reaches an open voting.
// Returns the locked voting, or null if it opened or is due to open.
// An election that is due and still scheduled could not open because of its ballot (ballot_problem,
// see lib/elections.js): the JC can still fix the ballot or delete the election.
const lockScheduledVoting = async (votingId, transaction) => {
    const voting = await Voting.findByPk(votingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!voting || voting.status !== 'scheduled') {
        return null;
    }
    if (new Date(voting.opens_at).getTime() <= Date.now() && voting.kind !== 'election') {
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

// With ?phase=pre_agora this is the overview of the Pre-Agora round: per item the result,
// the quorum (antennae_voted of quorum_required) and the outcome with its reason.
exports.listVotings = async (req, res) => {
    const where = { event_id: req.event.id };
    if (helpers.isDefined(req.query.phase)) {
        if (!PHASES.includes(req.query.phase)) {
            return errors.makeBadRequestError(res, 'The phase should be one of these: "agora", "pre_agora".');
        }
        where.phase = req.query.phase;
    }

    const found = await Voting.findAll({
        where,
        order: [['opens_at', 'ASC'], ['id', 'ASC']]
    });

    const votings = [];
    for (const voting of found) {
        // A voting that cannot move on now (a Pre-Agora voting while core is down) is listed
        // in its stored status, so it does not break the list of the other votings.
        try {
            votings.push(await lifecycle.syncVoting(voting));
        } catch (err) {
            logger.error({ err, voting: voting.id }, 'Listing votings: could not move on the voting.');
            votings.push(voting);
        }
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
        data: await presentVoting(req.voting, req.permissions.manage_votings)
    });
};

// The ballot of a new election: the position must be a position of this Agora, the seats are by
// default the places of the position, and the candidates are the approved candidatures of the
// position or the ones the JC chose. Without a position, the validation of the voting tells the JC.
const prepareElection = async (eventId, fields, candidateIds, transaction) => {
    if (!helpers.isDefined(fields.position_id)) {
        return { fields, candidates: [] };
    }

    const position = await elections.findPosition(fields.position_id, eventId, transaction);
    if (!position) {
        return { error: POSITION_MESSAGE };
    }

    const chosen = await elections.chooseCandidates(position, candidateIds, transaction);
    if (chosen.error) {
        return chosen;
    }

    return { fields: { seats: position.places, ...fields }, candidates: chosen.candidates };
};

exports.createVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    let fields = withPreAgoraMajority(lodash.pick(req.body, EDITABLE_FIELDS), 'agora', null);
    let candidates = [];
    if (fields.kind === 'election') {
        const prepared = await prepareElection(req.event.id, fields, req.body.candidates);
        if (prepared.error) {
            return errors.makeValidationError(res, prepared.error);
        }
        ({ fields, candidates } = prepared);
    }

    const voting = await sequelize.transaction(async (transaction) => {
        const created = await Voting.create({ ...fields, event_id: req.event.id }, { transaction });
        if (created.kind === 'election') {
            await elections.fillBallot(created, candidates, transaction);
        }
        return created;
    });

    return res.json({
        success: true,
        data: await presentVoting(await lifecycle.syncVoting(voting), true)
    });
};

// Edits a scheduled election. A new position gets the approved candidatures of that position on the
// ballot, and its places as seats, unless the JC gives them; new candidates replace the ballot.
// The old ballot goes before the position changes, and the new one comes after it, because the
// database only accepts candidates of the position of the election (candidate_of_position).
// An election that did not open on time needs a new time window in the future, so that it does not
// open and close at once, without ballots.
const editElection = async (election, fields, candidateIds, eventId, transaction) => {
    if (!isInFuture(election.opens_at)) {
        const opensAt = helpers.isDefined(fields.opens_at) ? fields.opens_at : election.opens_at;
        const closesAt = helpers.isDefined(fields.closes_at) ? fields.closes_at : election.closes_at;
        if (!isInFuture(opensAt) || !isInFuture(closesAt)) {
            return LATE_ELECTION_MESSAGE;
        }
    }

    const positionId = helpers.isDefined(fields.position_id) ? fields.position_id : election.position_id;
    const newPosition = positionId !== election.position_id;
    if (!newPosition && typeof candidateIds === 'undefined') {
        await election.update(fields, { fields: EDITABLE_FIELDS, transaction });
        return null;
    }

    const position = await elections.findPosition(positionId, eventId, transaction);
    if (!position) {
        return POSITION_MESSAGE;
    }

    const chosen = await elections.chooseCandidates(position, candidateIds, transaction);
    if (chosen.error) {
        return chosen.error;
    }

    const seats = newPosition && !helpers.isDefined(fields.seats) ? { seats: position.places } : {};
    await elections.clearBallot(election, transaction);
    await election.update({ ...fields, ...seats }, { fields: EDITABLE_FIELDS, transaction });
    await elections.fillBallot(election, chosen.candidates, transaction);
    return null;
};

exports.editVoting = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const edit = await sequelize.transaction(async (transaction) => {
        const locked = await lockScheduledVoting(req.voting.id, transaction);
        if (!locked) {
            return { conflict: 'Only a voting that did not open yet can be edited.' };
        }

        const fields = withPreAgoraMajority(lodash.pick(req.body, EDITABLE_FIELDS), locked.phase, locked.kind);
        const kind = helpers.isDefined(fields.kind) ? fields.kind : locked.kind;
        if ((kind === 'election') !== (locked.kind === 'election')) {
            return { error: KIND_CHANGE_MESSAGE };
        }

        if (locked.kind === 'election') {
            const error = await editElection(locked, fields, req.body.candidates, req.event.id, transaction);
            return error ? { error } : { voting: locked };
        }

        await locked.update(fields, { fields: EDITABLE_FIELDS, transaction });
        return { voting: locked };
    });

    if (edit.conflict) {
        return errors.makeConflictError(res, edit.conflict);
    }
    if (edit.error) {
        return errors.makeValidationError(res, edit.error);
    }

    return res.json({
        success: true,
        data: await presentVoting(await lifecycle.syncVoting(edit.voting), true)
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
        data: await presentVoting(req.voting, true)
    });
};

// The JC marks that an amendment to the item came in at least five days before the Agora,
// so the Agora votes on the item again (Art. 20(5)). This can happen before or after the
// Pre-Agora voting closed; after closing, the outcome changes with it. Unmarking it is refused
// when a voting on the Agora already follows the item, because then the item would be both
// decided and voted on again.
exports.markAmendment = async (req, res) => {
    if (!req.permissions.manage_votings) {
        return errors.makeForbiddenError(res, 'You cannot manage votings.');
    }

    const amendmentSubmitted = req.body.amendment_submitted;
    if (typeof amendmentSubmitted !== 'boolean') {
        return errors.makeValidationError(res, 'The field "amendment_submitted" should be true or false.');
    }

    if (req.voting.phase !== 'pre_agora') {
        return errors.makeConflictError(res, 'Only a Pre-Agora voting can be sent to the Agora by an amendment.');
    }

    // Locking the voting waits for a closing that runs right now, so the outcome uses the final result.
    const voting = await sequelize.transaction(async (transaction) => {
        const locked = await Voting.findByPk(req.voting.id, { transaction, lock: transaction.LOCK.UPDATE });
        const changes = { amendment_submitted: amendmentSubmitted };
        if (locked.status === 'closed') {
            Object.assign(changes, rules.preAgoraOutcome({ ...locked.toJSON(), amendment_submitted: amendmentSubmitted }));
        }

        if (changes.outcome === 'decided') {
            const following = await Voting.count({ where: { follows_voting_id: locked.id }, transaction });
            if (following > 0) {
                return null;
            }
        }

        return locked.update(changes, { transaction });
    });

    if (!voting) {
        return errors.makeConflictError(res, 'A voting on the Agora already follows this item, so it cannot be decided before the Agora.');
    }

    return res.json({
        success: true,
        data: formatVoting(voting, true)
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

// The result of an election: per candidate the votes, the share of the ballots cast, whether the
// threshold is reached and the outcome; the ballots cast (blank ones included) and the possible
// votes (votes_total, all votes in the snapshot). No table per body: a body with one delegate would
// show the choice of that delegate.
const getElectionResult = async (req, res) => {
    const { progress } = await lifecycle.countVotes(req.voting);
    const voting = req.voting.toJSON();

    return res.json({
        success: true,
        data: {
            voting: await presentVoting(req.voting, true),
            phase: voting.phase,
            election_rule: voting.election_rule,
            seats: voting.seats,
            published: voting.published,
            ...(await elections.result(req.voting)),
            ...progress,
            bodies_present_percentage: rules.percentage(progress.bodies_present, progress.bodies_available)
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

    if (req.voting.kind === 'election') {
        return getElectionResult(req, res);
    }

    const { tally, progress, bodies } = await lifecycle.countVotes(req.voting);
    const votesCast = tally.in_favour + tally.against + tally.abstention;
    const voting = req.voting.toJSON();

    return res.json({
        success: true,
        data: {
            voting: formatVoting(req.voting, true),
            phase: voting.phase,
            majority: voting.majority,
            result: voting.result,
            published: voting.published,
            // For a Pre-Agora voting: whether the item is decided or goes to the Agora, and why.
            outcome: voting.outcome,
            outcome_reason: voting.outcome_reason,
            quorum: voting.phase === 'pre_agora'
                ? lodash.pick(voting, ['antennae_total', 'quorum_required', 'antennae_voted', 'quorum_reached'])
                : null,
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
        const electorate = voting.phase === 'pre_agora' ? 'a delegate of this Agora' : 'a present delegate';
        return errors.makeForbiddenError(res, `You have no votes in this voting: you were not ${electorate} when it opened.`);
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
// In an election: the ballot to fill in, and how many ballots the delegate cast, never what is on them.
const MY_VOTE_VOTING_FIELDS = ['id', 'event_id', 'kind', 'title', 'description', 'majority', 'phase', 'opens_at', 'closes_at', 'status'];
const MY_VOTE_ELECTION_FIELDS = ['position_id', 'seats', 'election_rule'];

const formatMyVote = async (voting, delegateVote) => {
    const bodyAllotment = await findBodyAllotment(delegateVote);
    const delegatesCount = await VotingDelegateVote.count({
        where: { voting_id: delegateVote.voting_id, body_id: delegateVote.body_id }
    });
    const isElection = voting.kind === 'election';

    const myVote = {
        voting: helpers.whitelistObject(voting.toJSON(), isElection ? [...MY_VOTE_VOTING_FIELDS, ...MY_VOTE_ELECTION_FIELDS] : MY_VOTE_VOTING_FIELDS),
        body: {
            body_id: bodyAllotment.body_id,
            votes_total: bodyAllotment.votes_total,
            delegates_count: delegatesCount,
            votes_cast: bodyAllotment.votes_cast
        },
        body_id: delegateVote.body_id,
        max_votes: delegateVote.max_votes,
        votes_available: voting.status === 'open' ? rules.votesAvailable(bodyAllotment, delegateVote) : 0
    };

    if (isElection) {
        return {
            ...myVote,
            options: await elections.formatBallotForDelegate(voting),
            ballots_cast: delegateVote.ballots_cast,
            submitted_at: delegateVote.submitted_at
        };
    }

    return {
        ...myVote,
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
    delegate_withdrawn: (res) => errors.makeForbiddenError(res, 'You cannot vote: you are not a delegate of this Agora any more (cancelled or not accepted).'),
    body_vote_limit: (res, body) => errors.makeConflictError(
        res,
        `Your body has only ${body.votes_total - body.votes_cast} of its ${body.votes_total} votes left.`
    ),
    extra_vote_limit: (res, body, delegateVote) => errors.makeConflictError(
        res,
        `The extra votes of your body are already used by other delegates, you can cast at most ${rules.votesAvailable(body, delegateVote)} votes.`
    )
};

// The vote of a delegate in an election: one ballot per vote, each with the candidates marked,
// at most as many as there are seats; a blank ballot marks nobody. The ballot box stores them in
// one transaction with the counter of the delegate, under the same division rule as other votings.
const submitBallots = async (req, res) => {
    if (VOTE_FIELDS.some((field) => helpers.isDefined(req.body[field]))) {
        return errors.makeValidationError(res, 'An election is voted with ballots, not with in favour, against or abstention.');
    }

    const ballot = await elections.formatBallotForDelegate(req.voting);
    const refusal = elections.checkBallots(req.body.ballots, {
        seats: req.voting.seats,
        optionIds: ballot.map((option) => option.id),
        maxVotes: req.delegateVote.max_votes
    });
    if (refusal) {
        return errors.makeValidationError(res, refusal);
    }

    let updatedRow;
    try {
        updatedRow = await ballotBox.castBallots(req.delegateVote, req.body.ballots);
    } catch (err) {
        const tellDelegate = err instanceof ballotBox.BallotBoxError && VOTE_REFUSALS[err.constraint];
        if (!tellDelegate) {
            throw err;
        }

        const bodyAllotment = await findBodyAllotment(req.delegateVote);
        return tellDelegate(res, bodyAllotment, req.delegateVote);
    }

    return res.json({
        success: true,
        data: await formatMyVote(req.voting, updatedRow)
    });
};

exports.submitMyVote = async (req, res) => {
    if (req.voting.kind === 'election') {
        return submitBallots(req, res);
    }

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
