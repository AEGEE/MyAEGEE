// Pure rules of a voting. The database enforces the same division rule with constraints
// (see migrations/20261029120000-create-votings.js); these functions compute the numbers
// that the snapshot stores and that the API shows to a delegate.

// Divides the votes of a body over its delegates as equally as possible.
// Every delegate surely has min_votes. The extra_votes that are left over go to the first
// delegates who use them, one extra vote each, so the difference is never more than 1.
// Example: 5 votes and 3 delegates give min_votes 1 and extra_votes 2, so max_votes 2.
exports.splitVotes = (votesTotal, delegatesCount) => {
    const minVotes = Math.floor(votesTotal / delegatesCount);
    const extraVotes = votesTotal % delegatesCount;

    return {
        min_votes: minVotes,
        extra_votes: extraVotes,
        max_votes: extraVotes > 0 ? minVotes + 1 : minVotes
    };
};

// How many votes a delegate who did not vote yet can cast now, given the counters of the body.
exports.votesAvailable = (bodyAllotment, delegateVote) => {
    if (delegateVote.submitted_at) {
        return 0;
    }

    const extraVoteLeft = bodyAllotment.delegates_above_min < bodyAllotment.extra_votes;
    const delegateLimit = extraVoteLeft ? delegateVote.max_votes : bodyAllotment.min_votes;
    const bodyLimit = bodyAllotment.votes_total - bodyAllotment.votes_cast;

    return Math.max(0, Math.min(delegateLimit, bodyLimit));
};

// The share of part in total, in percent and rounded to 2 decimals; 0 when total is 0.
// Used for the share of the votes cast in all votes of a voting, as OMS showed it to the JC.
exports.percentage = (part, total) => {
    if (total === 0) {
        return 0;
    }

    return Math.round((part / total) * 10000) / 100;
};

// The majorities that a voting can require, as the old OMS JC module counted them:
// - simple: more votes in favour than against;
// - absolute: more votes in favour than against and abstentions together;
// - two_thirds: more than two thirds of all votes cast are in favour.
exports.isAccepted = (majority, { in_favour: inFavour, against, abstention }) => {
    switch (majority) {
    case 'simple':
        return inFavour > against;
    case 'absolute':
        return inFavour > against + abstention;
    case 'two_thirds':
        return inFavour > 2 * (against + abstention);
    default:
        throw new Error('Unknown majority: ' + majority);
    }
};
