const ballotBox = require('./ballot_box');
const rules = require('./voting_rules');
const {
    Candidate,
    Position,
    VotingBodyAllotment,
    VotingOption
} = require('../models');

// An election is a voting of kind 'election' for a position. The position is the vacancy and its
// candidatures (positions, candidates); the election is one moment of voting for it; its ballot
// (voting_options) lists the candidates of that one moment. A second round is a new election with
// its own, shorter ballot.
//
// - The JC creates the election with the candidates on the ballot: by default all approved
//   candidatures of the position, by last name; or the candidates the JC chooses, in that order.
// - It opens like every voting, with the snapshot of who can vote and how much, if the ballot is
//   still valid; the names of the candidates are copied to the ballot and the ballot is fixed.
// - A delegate casts one secret ballot per vote (Working Format of the Agora, Art. 11(3)), see lib/ballot_box.js.
// - At closing the system counts the votes per candidate and gives each candidate an outcome by the
//   election rule (lib/voting_rules.js); the JC checks it (nationality rules, a tie) and publishes it.

const candidateLabel = (candidate) => candidate.first_name + ' ' + candidate.last_name;

// The position of an election must be a position of the same Agora that is not deleted.
exports.findPosition = (positionId, eventId, transaction) => {
    if (!Number.isInteger(positionId)) {
        return null;
    }

    return Position.findOne({ where: { id: positionId, event_id: eventId, deleted: false }, transaction });
};

// The candidates for the ballot. Without candidateIds: all approved candidatures of the position,
// by last name. With candidateIds: those candidatures in that order; each must be an approved
// candidature for the position. Returns { candidates } or { error }.
exports.chooseCandidates = async (position, candidateIds, transaction) => {
    if (typeof candidateIds === 'undefined') {
        const approved = await Candidate.findAll({
            where: { position_id: position.id, status: 'approved' },
            order: [['last_name', 'ASC'], ['first_name', 'ASC'], ['id', 'ASC']],
            transaction
        });
        return approved.length > 0
            ? { candidates: approved }
            : { error: 'An election needs at least one approved candidate on the ballot.' };
    }

    if (!Array.isArray(candidateIds) || !candidateIds.every(Number.isInteger) || new Set(candidateIds).size !== candidateIds.length) {
        return { error: 'The field "candidates" should be a list of different candidate IDs.' };
    }
    if (candidateIds.length === 0) {
        return { error: 'An election needs at least one approved candidate on the ballot.' };
    }

    const found = await Candidate.findAll({
        where: { id: candidateIds, position_id: position.id, status: 'approved' },
        transaction
    });
    if (found.length !== candidateIds.length) {
        return { error: 'Only approved candidates for this position can be on the ballot.' };
    }

    return { candidates: candidateIds.map((id) => found.find((candidate) => candidate.id === id)) };
};

// Takes all candidates off the ballot of a scheduled election.
exports.clearBallot = (voting, transaction) => VotingOption.destroy({ where: { voting_id: voting.id }, transaction });

// Puts these candidates on the empty ballot of a scheduled election, in this order.
exports.fillBallot = async (voting, candidates, transaction) => {
    await VotingOption.bulkCreate(candidates.map((candidate, index) => ({
        voting_id: voting.id,
        candidate_id: candidate.id,
        label: candidateLabel(candidate),
        ballot_order: index + 1
    })), { transaction });
};

const findBallot = (votingId, transaction) => VotingOption.findAll({
    where: { voting_id: votingId },
    order: [['ballot_order', 'ASC']],
    transaction
});

// Why a scheduled election cannot open now, or null if it can: the position was deleted, the ballot
// is empty, a candidature on the ballot is not approved any more (it can change at any time,
// see setCandidatureStatus in lib/candidates.js), or its time window has passed (it would open and
// close at once, without ballots). The JC then fixes the election or deletes it.
exports.ballotProblem = async (voting, transaction) => {
    const position = await Position.findByPk(voting.position_id, { transaction });
    if (!position || position.deleted) {
        return 'The position of this election was deleted.';
    }

    const ballot = await VotingOption.findAll({
        where: { voting_id: voting.id },
        include: [{ model: Candidate, attributes: ['id', 'first_name', 'last_name', 'status'] }],
        order: [['ballot_order', 'ASC']],
        transaction
    });
    if (ballot.length === 0) {
        return 'The ballot of this election has no candidates.';
    }

    const notApproved = ballot.find((option) => option.candidate.status !== 'approved');
    if (notApproved) {
        return `The candidature of ${candidateLabel(notApproved.candidate)} is not approved any more.`;
    }

    if (new Date(voting.closes_at).getTime() <= Date.now()) {
        return 'The time window of this election has passed: set a new opens_at and closes_at in the future.';
    }

    return null;
};

// At opening, before the status changes: the ballot shows the names of the candidatures as they are now.
exports.copyNamesToBallot = async (voting, transaction) => {
    const ballot = await VotingOption.findAll({ where: { voting_id: voting.id }, include: [Candidate], transaction });
    for (const option of ballot) {
        await option.update({ label: candidateLabel(option.candidate) }, { transaction });
    }
};

// The count of an election: the ballot box, and the votes of all bodies in the snapshot (the possible
// votes of Art. 14(1)). votes_total of each body is its whole number of votes, not only the votes cast.
const countElection = async (voting, transaction) => {
    const box = await ballotBox.count(voting.id, transaction);
    const bodies = await VotingBodyAllotment.findAll({ where: { voting_id: voting.id }, transaction });
    const possible = bodies.reduce((acc, body) => acc + body.votes_total, 0);

    return { ...box, possible };
};

// At closing, after the status changed (and the ballot box was shuffled): the outcome of each candidate.
exports.storeOutcomes = async (voting, transaction) => {
    const { ballots, possible, votesPerOption } = await countElection(voting, transaction);
    const outcomes = rules.electionOutcomes(voting.election_rule, votesPerOption, { ballots, possible, seats: voting.seats });

    for (const option of await findBallot(voting.id, transaction)) {
        await option.update({ outcome: outcomes[option.id] }, { transaction });
    }
};

// The ballot as the voting shows it. The outcome of a candidate is part of the result, so until the
// result is published only the JC sees it. The JC also sees why a scheduled election cannot open.
exports.formatBallot = async (voting, canManage) => {
    const ballot = await findBallot(voting.id);
    const showOutcome = canManage || voting.published;
    const json = {
        options: ballot.map((option) => ({
            id: option.id,
            candidate_id: option.candidate_id,
            label: option.label,
            ballot_order: option.ballot_order,
            outcome: showOutcome ? option.outcome : null
        }))
    };

    if (canManage) {
        json.ballot_problem = voting.status === 'scheduled' ? await exports.ballotProblem(voting) : null;
    }

    return json;
};

// The ballot as a delegate fills it in: the options, without candidature details or outcome.
exports.formatBallotForDelegate = async (voting) => {
    const ballot = await findBallot(voting.id);
    return ballot.map((option) => ({ id: option.id, label: option.label, ballot_order: option.ballot_order }));
};

// Checks the ballots of one delegate before they go to the database, which checks the same rules.
// Returns the reason to refuse, or null.
exports.checkBallots = (ballots, { seats, optionIds, maxVotes }) => {
    const isBallot = (ballot) => Array.isArray(ballot) && ballot.every(Number.isInteger);
    if (!Array.isArray(ballots) || !ballots.every(isBallot)) {
        return 'The field "ballots" should be a list of ballots, each a list of IDs of the candidates on the ballot.';
    }
    if (ballots.length < 1) {
        return 'You should cast at least one ballot.';
    }
    if (ballots.length > maxVotes) {
        return `You can cast at most ${maxVotes} ballots.`;
    }
    if (ballots.some((ballot) => ballot.length > seats)) {
        return `A ballot can mark at most ${seats} candidates.`;
    }
    if (ballots.some((ballot) => new Set(ballot).size !== ballot.length)) {
        return 'A ballot can mark a candidate only once.';
    }
    if (ballots.some((ballot) => ballot.some((optionId) => !optionIds.includes(optionId)))) {
        return 'A ballot can only mark candidates of this election.';
    }

    return null;
};

// The result of an election, once it is closed: per candidate the votes, the share of the ballots
// cast, whether the threshold is reached and the outcome. Only totals: not per body, not per ballot.
exports.result = async (voting) => {
    const {
        ballots,
        blank,
        possible,
        votesPerOption
    } = await countElection(voting);
    const ballot = await findBallot(voting.id);
    const numbers = {
        ballots,
        possible,
        seats: voting.seats,
        candidates: ballot.length
    };

    return {
        ballots_cast: ballots,
        blank_ballots: blank,
        candidates: ballot.map((option) => ({
            option_id: option.id,
            candidate_id: option.candidate_id,
            label: option.label,
            ballot_order: option.ballot_order,
            votes: votesPerOption[option.id],
            percentage: rules.percentage(votesPerOption[option.id], ballots),
            reaches_threshold: rules.reachesThreshold(voting.election_rule, votesPerOption[option.id], numbers),
            outcome: option.outcome
        }))
    };
};
