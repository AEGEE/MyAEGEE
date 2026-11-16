const crypto = require('crypto');

const { sequelize } = require('./sequelize');
const { VotingDelegateVote } = require('../models');

// The ballot box of an election: the only code that writes or reads voting_ballots and
// voting_ballot_marks. A ballot has no person, body, time or sequence number, only a random ID,
// so what is on it cannot be traced to a delegate (see migrations/20261030180000-add-elections.js).
//
// Nothing here goes to the log: every query has logging off (Sequelize logs SQL on debug level),
// and an error from the database is replaced by one that only names the refused constraint,
// because the error of the database can hold the SQL, its parameters and the values of a row.

// The error of a refused vote: constraint is the name of the rule of the database that refused it.
class BallotBoxError extends Error {
    constructor(constraint) {
        super(constraint ? 'The ballots are refused: ' + constraint + '.' : 'The ballots could not be stored.');
        this.name = 'BallotBoxError';
        this.constraint = constraint || null;
    }
}

exports.BallotBoxError = BallotBoxError;

// Stores the vote of a delegate in an election, in one transaction: first the number of ballots on
// the row of the delegate (the trigger count_delegate_votes checks the window, the delegate and the
// division rule of the body, under a lock per body), then the ballots, then the marks on each ballot.
// At commit, the database checks that the box holds as many ballots as the delegates counted.
// ballots is a list of ballots, each a list of option IDs; a blank ballot is an empty list.
// Returns the updated row of the delegate, which tells how many ballots, not what is on them.
exports.castBallots = async (delegateVote, ballots) => {
    const ballotIds = ballots.map(() => crypto.randomUUID());
    const markBallots = [];
    const markOptions = [];
    ballots.forEach((marks, index) => {
        for (const optionId of marks) {
            markBallots.push(ballotIds[index]);
            markOptions.push(optionId);
        }
    });

    try {
        return await sequelize.transaction(async (transaction) => {
            const [, updatedRows] = await VotingDelegateVote.update({ ballots_cast: ballots.length }, {
                where: { voting_id: delegateVote.voting_id, application_id: delegateVote.application_id },
                returning: true,
                transaction,
                logging: false
            });

            await sequelize.query('INSERT INTO voting_ballots (id, voting_id) SELECT unnest($1::uuid[]), $2', {
                bind: [ballotIds, delegateVote.voting_id],
                transaction,
                logging: false
            });

            if (markOptions.length > 0) {
                await sequelize.query(`
                    INSERT INTO voting_ballot_marks (voting_id, ballot_id, option_id)
                    SELECT $1, unnest($2::uuid[]), unnest($3::integer[])
                `, {
                    bind: [delegateVote.voting_id, markBallots, markOptions],
                    transaction,
                    logging: false
                });
            }

            return updatedRows[0];
        });
    } catch (err) {
        const original = err.parent || err.original || err;
        throw new BallotBoxError(original.constraint);
    }
};

// Counts the ballot box: all ballots (blank ones included), the blank ballots, and per option on the
// ballot the number of ballots that mark it. After closing, the box is shuffled, so the count is the
// same as before but no ballot can be traced to a delegate any more.
exports.count = async (votingId, transaction) => {
    const [[box]] = await sequelize.query(`
        SELECT count(*) AS ballots,
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM voting_ballot_marks m WHERE m.ballot_id = b.id)) AS blank
        FROM voting_ballots b
        WHERE b.voting_id = $1
    `, { bind: [votingId], transaction, logging: false });

    const [options] = await sequelize.query(`
        SELECT o.id, count(m.ballot_id) AS votes
        FROM voting_options o
        LEFT JOIN voting_ballot_marks m ON m.voting_id = o.voting_id AND m.option_id = o.id
        WHERE o.voting_id = $1
        GROUP BY o.id
    `, { bind: [votingId], transaction, logging: false });

    return {
        ballots: box.ballots,
        blank: box.blank,
        votesPerOption: Object.fromEntries(options.map((option) => [option.id, option.votes]))
    };
};
