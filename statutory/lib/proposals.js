const lodash = require('lodash');

const errors = require('./errors');
const helpers = require('./helpers');
const { Proposal } = require('../models');

// A proposal is an item on the agenda of an Agora (Statutes Art. 14(13); Working Format of the Agora, Art. 8).
// - Any logged-in user submits a proposal and is its proposer (created_by): a title, the names of the
//   proposers, the part of the CIA it changes and a link to its text and motivation. The text stays
//   outside MyAEGEE.
// - The JC puts it on the agenda (on_agenda) or does not admit it, with a reason (not_admitted).
//   Its text never changes (proposal_text_is_fixed holds once it is not submitted any more).
// - The proposer or the JC can withdraw it, but not once the Agora votes on it.
// - Every logged-in user sees a proposal that was on the agenda (on_agenda_at), also once it is withdrawn.
//   A proposal that is submitted, not admitted or withdrawn before it was on the agenda only its proposer
//   and the JC see. The reason of the JC only its proposer and the JC see.
// - A voting of kind 'proposal' points to a proposal on the agenda; the decision of the Agora is copied
//   to the proposal when the voting that decides it is published (copyDecision).
// The database keeps the steps (trigger proposal_guard); this module checks who may take them.

// The fields that the proposer gives. Status, reason and decision change only through their own routes.
const SUBMITTED_FIELDS = ['title', 'proposers', 'cia_part', 'text_url'];

// How each refusal of the database (named after its rule) is told to the user. A trigger gives a
// message that is written for people; a CHECK constraint gets one here.
const REFUSALS = {
    proposal_status_flow: (res, message) => errors.makeConflictError(res, message),
    proposal_in_voting: (res, message) => errors.makeConflictError(res, message),
    decision_when_on_agenda: (res) => errors.makeConflictError(res, 'The Agora already decided on this proposal, so it cannot be withdrawn.'),
    not_admitted_needs_reason: (res) => errors.makeValidationError(res, 'The JC should give a reason (jc_reason) when it does not admit a proposal.')
};

// Runs a write of the route. Returns the response when the database refused it with one of the
// rules in refusals; throws any other error.
exports.withRefusals = async (res, refusals, write) => {
    try {
        await write();
        return null;
    } catch (err) {
        const refusal = refusals[errors.refusedRule(err)];
        if (!refusal) {
            throw err;
        }
        return refusal(res, err.parent.message);
    }
};

exports.checkIfAgora = async (req, res, next) => {
    if (req.event.type !== 'agora') {
        return errors.makeBadRequestError(res, 'Proposals are only available for Agora.');
    }

    return next();
};

// Whether the user of the request sees this proposal, and so also the reason of the JC on it.
const canSee = (req, proposal) => proposal.on_agenda_at !== null
    || proposal.created_by === req.user.id
    || req.permissions.manage_proposals;

// A proposal as this user sees it: on the agenda without the reason of the JC, unless the user is its proposer or the JC.
const formatProposal = (req, proposal) => {
    const json = proposal.toJSON();
    if (proposal.created_by !== req.user.id && !req.permissions.manage_proposals) {
        json.jc_reason = null;
    }
    return json;
};

exports.findProposal = async (req, res, next) => {
    if (!helpers.isNumber(req.params.proposal_id)) {
        return errors.makeBadRequestError(res, 'The proposal ID is invalid.');
    }

    const proposal = await Proposal.findOne({
        where: { id: Number(req.params.proposal_id), event_id: req.event.id }
    });
    if (!proposal || !canSee(req, proposal)) {
        return errors.makeNotFoundError(res, 'Proposal is not found.');
    }

    req.proposal = proposal;
    return next();
};

// The proposals of the Agora that this user sees, in the order they came in.
exports.listProposals = async (req, res) => {
    const proposals = await Proposal.findAll({
        where: { event_id: req.event.id },
        order: [['id', 'ASC']]
    });

    return res.json({
        success: true,
        data: proposals.filter((proposal) => canSee(req, proposal)).map((proposal) => formatProposal(req, proposal))
    });
};

exports.getProposal = async (req, res) => {
    return res.json({
        success: true,
        data: formatProposal(req, req.proposal)
    });
};

// No deadline is checked here: the JC decides on a proposal that came in late (WF Agora Art. 21(3)).
exports.submitProposal = async (req, res) => {
    const proposal = await Proposal.create({
        ...lodash.pick(req.body, SUBMITTED_FIELDS),
        event_id: req.event.id,
        created_by: req.user.id
    });

    return res.json({
        success: true,
        data: proposal
    });
};

const isProposer = (req) => req.proposal.created_by === req.user.id;

// The JC puts a proposal on the agenda or does not admit it (with jc_reason); the proposer or the JC
// withdraws it. Which steps exist, the database decides (proposal_status_flow).
exports.setProposalStatus = async (req, res) => {
    const { status } = req.body;
    const mayWithdraw = isProposer(req) || req.permissions.manage_proposals;
    if (status === 'withdrawn' ? !mayWithdraw : !req.permissions.manage_proposals) {
        return errors.makeForbiddenError(res, status === 'withdrawn'
            ? 'Only the proposer or the JC can withdraw this proposal.'
            : 'Only the JC can put a proposal on the agenda or not admit it.');
    }

    const changes = { status };
    if (req.permissions.manage_proposals && helpers.isDefined(req.body.jc_reason)) {
        changes.jc_reason = req.body.jc_reason;
    }

    const refused = await exports.withRefusals(res, REFUSALS, () => req.proposal.update(changes, { fields: ['status', 'jc_reason'] }));
    if (refused) {
        return refused;
    }

    return res.json({
        success: true,
        data: await req.proposal.reload()
    });
};

// Why a scheduled voting on a proposal cannot open now, or null if it can: its proposal is not on the
// agenda (the proposer withdrew it) or the Agora already decided on it. The database refuses the same at
// opening (guard_proposal_voting); the voting then stays scheduled and the JC can delete it.
// In a transaction, this takes the same share lock on the proposal as the opening, so a withdrawal waits
// until the opening is done.
exports.proposalProblem = async (voting, transaction) => {
    if (voting.kind !== 'proposal' || voting.proposal_id === null) {
        return null;
    }

    const proposal = await Proposal.findByPk(voting.proposal_id, {
        transaction,
        lock: transaction ? transaction.LOCK.SHARE : undefined
    });
    if (proposal.status !== 'on_agenda') {
        return `The proposal of this voting is not on the agenda (${proposal.status}).`;
    }
    if (proposal.decision !== null) {
        return 'The Agora already decided on the proposal of this voting.';
    }
    return null;
};

// What a voting decided for its proposal, or null: a closed and published voting on a proposal; on the
// Agora its result, before the Agora 'accepted' when the item is decided there. The same as the
// database function decision_of_voting.
const decisionOf = (voting) => {
    if (voting.kind !== 'proposal' || voting.status !== 'closed' || !voting.published) {
        return null;
    }
    if (voting.phase === 'agora') {
        return voting.result;
    }
    return voting.outcome === 'decided' ? 'accepted' : null;
};

// Brings the decision on the proposal of a voting in line with the voting, in the transaction that
// changed the voting: when the JC publishes a voting on the Agora, when a Pre-Agora voting closes, and
// when the JC marks or unmarks an amendment on a closed Pre-Agora voting (Art. 20(5)).
// A proposal that another voting already decided keeps that decision.
exports.copyDecision = async (voting, transaction) => {
    if (voting.proposal_id === null) {
        return;
    }

    const decision = decisionOf(voting);
    if (decision) {
        await Proposal.update(
            { decision, decided_by_voting_id: voting.id },
            { where: { id: voting.proposal_id, decision: null }, transaction }
        );
        return;
    }

    await Proposal.update(
        { decision: null, decided_by_voting_id: null },
        { where: { id: voting.proposal_id, decided_by_voting_id: voting.id }, transaction }
    );
};
