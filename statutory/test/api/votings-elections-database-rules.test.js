const crypto = require('crypto');

const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { Voting, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

const { sequelize } = Voting;

// The secret ballot of an election lives in the database itself: the ballot box (voting_ballots,
// voting_ballot_marks) has no person on it, always holds as many ballots as the delegates counted,
// and is shuffled when the election closes. These tests write to the tables directly, not through
// the vote route, and expect the database to refuse what breaks a rule.
describe('Votings database rules: elections', () => {
    let event;
    let election;
    let other;
    let delegates;

    const query = async (sql, bind = []) => {
        const [rows] = await sequelize.query(sql, { bind });
        return rows;
    };

    const refusalOf = async (promise) => {
        try {
            await promise;
        } catch (err) {
            return err.parent ? err.parent.constraint : err.message;
        }
        throw new Error('The database accepted the write.');
    };

    // What the vote route does: in one transaction, the counter on the row of the delegate,
    // then one ballot per vote with a random ID, then the marks on each ballot.
    const castBallots = (votingId, delegate, ballots) => sequelize.transaction(async (transaction) => {
        await sequelize.query('UPDATE voting_delegate_votes SET ballots_cast = $1 WHERE voting_id = $2 AND application_id = $3', {
            bind: [ballots.length, votingId, delegate.id], transaction
        });
        for (const marks of ballots) {
            const ballotId = crypto.randomUUID();
            await sequelize.query('INSERT INTO voting_ballots (id, voting_id) VALUES ($1, $2)', { bind: [ballotId, votingId], transaction });
            for (const optionId of marks) {
                await sequelize.query('INSERT INTO voting_ballot_marks (voting_id, ballot_id, option_id) VALUES ($1, $2, $3)', {
                    bind: [votingId, ballotId, optionId], transaction
                });
            }
        }
    });

    // The snapshot of an open voting, as the lifecycle takes it: one body with the votes,
    // and the delegates with the most votes each can cast.
    const openWithSnapshot = async (voting, { votes, delegates: people }) => {
        const delegatesCount = people.length;
        const minVotes = Math.floor(votes / delegatesCount);
        const extraVotes = votes % delegatesCount;
        await VotingBodyAllotment.create({ voting_id: voting.id, body_id: 1, votes_total: votes, min_votes: minVotes, extra_votes: extraVotes });
        for (const delegate of people) {
            await VotingDelegateVote.create({
                voting_id: voting.id,
                application_id: delegate.id,
                user_id: delegate.user_id,
                body_id: 1,
                max_votes: extraVotes > 0 ? minVotes + 1 : minVotes
            });
        }
        await query("UPDATE votings SET status = 'open', opened_at = now(), opens_at = now() - interval '1 second' WHERE id = $1", [voting.id]);
    };

    const ballotBox = async (votingId) => {
        const [box] = await query(`
            SELECT (SELECT count(*) FROM voting_ballots WHERE voting_id = $1) AS ballots,
                   (SELECT count(*) FROM voting_ballot_marks WHERE voting_id = $1) AS marks,
                   (SELECT COALESCE(sum(ballots_cast), 0) FROM voting_delegate_votes WHERE voting_id = $1) AS counted,
                   (SELECT votes_cast FROM voting_body_allotments WHERE voting_id = $1 AND body_id = 1) AS body_votes_cast
        `, [votingId]);
        return box;
    };

    // An election for 2 seats with candidates A, B and C, and a body with 5 votes and 3 delegates:
    // minimum 1, 2 extra votes, so each delegate casts at most 2 ballots. Another open election
    // has one candidate of its own.
    beforeEach(async () => {
        event = await generator.createEvent({ type: 'agora', applications: [] });
        delegates = [];
        for (let index = 0; index < 4; index++) {
            delegates.push(await generator.createPresentDelegate({ user_id: 100 + index, body_id: 1 }, event));
        }

        election = await generator.createElection({ seats: 2, opens_at: new Date(Date.now() - 1000), closes_at: new Date(Date.now() + 3600 * 1000) }, event);
        await openWithSnapshot(election.voting, { votes: 5, delegates: delegates.slice(0, 3) });

        other = await generator.createElection({ seats: 1, opens_at: new Date(Date.now() - 1000), closes_at: new Date(Date.now() + 3600 * 1000) }, event, { candidatesCount: 1 });
        await openWithSnapshot(other.voting, { votes: 1, delegates: delegates.slice(3) });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        cron.clearAll();
        await generator.clearAll();
    });

    describe('casting ballots', () => {
        test('stores the ballots without a person, and counts them on the delegate and the body', async () => {
            const [A, B, C] = election.ballot.map((option) => option.id);
            await castBallots(election.voting.id, delegates[0], [[A, B], [C]]);

            expect(await ballotBox(election.voting.id)).toEqual({ ballots: 2, marks: 3, counted: 2, body_votes_cast: 2 });
            const row = await VotingDelegateVote.findOne({ where: { voting_id: election.voting.id, application_id: delegates[0].id } });
            expect(row.ballots_cast).toEqual(2);
            expect(row.submitted_at).not.toEqual(null);

            // No column of the ballot box tells who cast a ballot, from which body, or when.
            const columns = await query(`
                SELECT table_name, column_name FROM information_schema.columns
                WHERE table_name IN ('voting_ballots', 'voting_ballot_marks') ORDER BY table_name, ordinal_position
            `);
            expect(columns.map((column) => column.table_name + '.' + column.column_name)).toEqual([
                'voting_ballot_marks.voting_id',
                'voting_ballot_marks.ballot_id',
                'voting_ballot_marks.option_id',
                'voting_ballots.id',
                'voting_ballots.voting_id'
            ]);
        });

        test('accepts a blank ballot: a ballot without marks', async () => {
            const [A] = election.ballot.map((option) => option.id);
            await castBallots(election.voting.id, delegates[0], [[A], []]);

            expect(await ballotBox(election.voting.id)).toMatchObject({ ballots: 2, marks: 1, counted: 2 });
        });

        test('refuses more ballots than the delegate has votes (delegate_vote_limit)', async () => {
            const [A] = election.ballot.map((option) => option.id);
            expect(await refusalOf(castBallots(election.voting.id, delegates[0], [[A], [A], [A]]))).toEqual('delegate_vote_limit');
            expect(await ballotBox(election.voting.id)).toMatchObject({ ballots: 0, counted: 0 });
        });

        test('refuses more marks on a ballot than there are seats (marks_within_seats)', async () => {
            const [A, B, C] = election.ballot.map((option) => option.id);
            expect(await refusalOf(castBallots(election.voting.id, delegates[0], [[A, B, C]]))).toEqual('marks_within_seats');
        });

        test('refuses two marks for the same candidate on one ballot (one_mark_per_candidate)', async () => {
            const [A] = election.ballot.map((option) => option.id);
            expect(await refusalOf(castBallots(election.voting.id, delegates[0], [[A, A]]))).toEqual('one_mark_per_candidate');
        });

        test('refuses a mark for a candidate of another election (mark_for_candidate_of_voting)', async () => {
            expect(await refusalOf(castBallots(election.voting.id, delegates[0], [[other.ballot[0].id]]))).toEqual('mark_for_candidate_of_voting');
        });

        test('keeps the division rule of the body (body_vote_limit, extra_vote_limit)', async () => {
            await VotingBodyAllotment.sequelize.query('SELECT 1'); // the body has 5 votes: 2 + 2 + 1
            const [A, B, C] = election.ballot.map((option) => option.id);
            await castBallots(election.voting.id, delegates[0], [[A, B], [C]]);
            await castBallots(election.voting.id, delegates[1], [[A], []]);

            expect(await refusalOf(castBallots(election.voting.id, delegates[2], [[B], [C]]))).toEqual('body_vote_limit');
            await castBallots(election.voting.id, delegates[2], [[B, C]]);
            expect(await ballotBox(election.voting.id)).toMatchObject({ ballots: 5, counted: 5, body_votes_cast: 5 });
        });

        test('refuses a second vote of the same delegate (already_voted)', async () => {
            const [A] = election.ballot.map((option) => option.id);
            await castBallots(election.voting.id, delegates[0], [[A]]);
            expect(await refusalOf(castBallots(election.voting.id, delegates[0], [[A]]))).toEqual('already_voted');
        });

        test('refuses in_favour, against or abstention on the row of a delegate in an election (vote_form_matches_kind)', async () => {
            expect(await refusalOf(query(
                'UPDATE voting_delegate_votes SET in_favour = 1 WHERE voting_id = $1 AND application_id = $2',
                [election.voting.id, delegates[0].id]
            ))).toEqual('vote_form_matches_kind');
        });

        test('refuses ballots_cast on the row of a delegate in a proposal (vote_form_matches_kind)', async () => {
            const proposal = await generator.createVoting({ kind: 'proposal', opens_at: new Date(Date.now() - 1000), closes_at: new Date(Date.now() + 3600 * 1000) }, event);
            const delegate = await generator.createPresentDelegate({ user_id: 200, body_id: 1 }, event);
            await openWithSnapshot(proposal, { votes: 1, delegates: [delegate] });

            expect(await refusalOf(query(
                'UPDATE voting_delegate_votes SET ballots_cast = 1 WHERE voting_id = $1',
                [proposal.id]
            ))).toEqual('vote_form_matches_kind');
        });

        test('refuses a ballot when the election is not open (voting_not_open)', async () => {
            const [A] = election.ballot.map((option) => option.id);
            await generator.endVotingTime(election.voting);
            expect(await refusalOf(castBallots(election.voting.id, delegates[0], [[A]]))).toEqual('voting_not_open');

            const scheduled = await generator.createElection({}, event);
            expect(await refusalOf(query('INSERT INTO voting_ballots (id, voting_id) VALUES ($1, $2)', [crypto.randomUUID(), scheduled.voting.id])))
                .toEqual('voting_not_open');
        });
    });

    describe('writes that do not go through the vote route', () => {
        test('refuses a ballot that no delegate counted: ballot stuffing (ballots_match_votes)', async () => {
            // Sequelize closes the connection of a transaction whose commit fails, and warns about it.
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            const stuffing = sequelize.transaction((transaction) => sequelize.query(
                'INSERT INTO voting_ballots (id, voting_id) VALUES ($1, $2)',
                { bind: [crypto.randomUUID(), election.voting.id], transaction }
            ));
            expect(await refusalOf(stuffing)).toEqual('ballots_match_votes');
            expect(await ballotBox(election.voting.id)).toMatchObject({ ballots: 0 });
        });

        test('refuses a delegate who counts a ballot that is not in the box (ballots_match_votes)', async () => {
            expect(await refusalOf(query(
                'UPDATE voting_delegate_votes SET ballots_cast = 1 WHERE voting_id = $1 AND application_id = $2',
                [election.voting.id, delegates[0].id]
            ))).toEqual('ballots_match_votes');
        });

        test('refuses to remove a ballot or change a mark (ballots_are_final)', async () => {
            const [A, B] = election.ballot.map((option) => option.id);
            await castBallots(election.voting.id, delegates[0], [[A]]);

            expect(await refusalOf(query('DELETE FROM voting_ballots WHERE voting_id = $1', [election.voting.id]))).toEqual('ballots_are_final');
            expect(await refusalOf(query('UPDATE voting_ballot_marks SET option_id = $2 WHERE voting_id = $1', [election.voting.id, B])))
                .toEqual('ballots_are_final');
            expect(await refusalOf(query('DELETE FROM voting_ballot_marks WHERE voting_id = $1', [election.voting.id]))).toEqual('ballots_are_final');
            expect(await ballotBox(election.voting.id)).toMatchObject({ ballots: 1, marks: 1 });
        });

        test('refuses to change the candidates on the ballot once the election opened (ballot_is_fixed)', async () => {
            const [A] = election.ballot.map((option) => option.id);
            const candidate = await generator.createCandidate({ status: 'approved' }, election.position);

            expect(await refusalOf(query(
                "INSERT INTO voting_options (voting_id, candidate_id, label, ballot_order) VALUES ($1, $2, 'New', 9)",
                [election.voting.id, candidate.id]
            ))).toEqual('ballot_is_fixed');
            expect(await refusalOf(query("UPDATE voting_options SET label = 'Other name' WHERE id = $1", [A]))).toEqual('ballot_is_fixed');
            expect(await refusalOf(query('UPDATE voting_options SET ballot_order = 9 WHERE id = $1', [A]))).toEqual('ballot_is_fixed');
            expect(await refusalOf(query('DELETE FROM voting_options WHERE id = $1', [A]))).toEqual('ballot_is_fixed');
        });

        test('refuses a candidate of another position on the ballot (candidate_of_position)', async () => {
            const scheduled = await generator.createElection({}, event);
            expect(await refusalOf(query(
                "INSERT INTO voting_options (voting_id, candidate_id, label, ballot_order) VALUES ($1, $2, 'x', 9)",
                [scheduled.voting.id, other.candidates[0].id]
            ))).toEqual('candidate_of_position');
        });

        test('refuses to change the position of an election with candidates on the ballot (candidate_of_position)', async () => {
            const scheduled = await generator.createElection({}, event);
            expect(await refusalOf(query('UPDATE votings SET position_id = $2 WHERE id = $1', [scheduled.voting.id, other.position.id])))
                .toEqual('candidate_of_position');
        });

        test('refuses candidates on the ballot of a voting that is not an election (options_only_for_elections)', async () => {
            const proposal = await generator.createVoting({ kind: 'proposal' }, event);
            expect(await refusalOf(query(
                "INSERT INTO voting_options (voting_id, candidate_id, label, ballot_order) VALUES ($1, $2, 'x', 1)",
                [proposal.id, election.candidates[0].id]
            ))).toEqual('options_only_for_elections');

            const scheduled = await generator.createElection({}, event);
            expect(await refusalOf(query(
                "UPDATE votings SET kind = 'proposal', majority = 'simple', position_id = NULL, seats = NULL, election_rule = NULL WHERE id = $1",
                [scheduled.voting.id]
            ))).toEqual('options_only_for_elections');
        });

        test('refuses an election without its fields, or with a majority, and a proposal with them (election_fields)', async () => {
            const insert = (fields) => query(`
                INSERT INTO votings (event_id, kind, title, majority, position_id, seats, election_rule, opens_at, closes_at, created_at, updated_at)
                VALUES ($1, $2, 'x', $3, $4, $5, $6, now() + interval '1 hour', now() + interval '2 hours', now(), now())
            `, [event.id, fields.kind, fields.majority, fields.position_id, fields.seats, fields.election_rule]);
            const valid = { kind: 'election', majority: null, position_id: election.position.id, seats: 1, election_rule: 'absolute_majority' };

            expect(await refusalOf(insert({ ...valid, majority: 'simple' }))).toEqual('election_fields');
            expect(await refusalOf(insert({ ...valid, position_id: null }))).toEqual('election_fields');
            expect(await refusalOf(insert({ ...valid, seats: null }))).toEqual('election_fields');
            expect(await refusalOf(insert({ ...valid, election_rule: null }))).toEqual('election_fields');
            expect(await refusalOf(insert({ ...valid, kind: 'proposal', majority: 'simple' }))).toEqual('election_fields');
            expect(await refusalOf(insert({ ...valid, kind: 'proposal', majority: null, position_id: null, seats: null, election_rule: null })))
                .toEqual('election_fields');
            await insert(valid);
        });

        test('refuses an election in Pre-Agora Voting (elections_on_the_agora)', async () => {
            expect(await refusalOf(query("UPDATE votings SET phase = 'pre_agora' WHERE id = $1", [election.voting.id])))
                .toEqual('elections_on_the_agora');
        });

        test('refuses an accepted or rejected result on an election (election_has_no_result)', async () => {
            expect(await refusalOf(query("UPDATE votings SET result = 'accepted' WHERE id = $1", [election.voting.id])))
                .toEqual('election_has_no_result');
        });
    });

    describe('closing shuffles the ballot box', () => {
        const linkByTransaction = async (votingId) => {
            const [link] = await query(`
                SELECT count(*) AS ballots,
                       count(*) FILTER (WHERE EXISTS (
                           SELECT 1 FROM voting_delegate_votes d WHERE d.voting_id = b.voting_id AND d.xmin::text = b.xmin::text
                       )) AS linked,
                       count(DISTINCT b.xmin::text) AS transactions
                FROM voting_ballots b WHERE b.voting_id = $1
            `, [votingId]);
            return link;
        };

        const contents = (votingId) => query(`
            SELECT b.id, COALESCE(string_agg(m.option_id::text, ',' ORDER BY m.option_id), '') AS marks
            FROM voting_ballots b LEFT JOIN voting_ballot_marks m ON m.ballot_id = b.id
            WHERE b.voting_id = $1 GROUP BY b.id ORDER BY b.id
        `, [votingId]);

        test('unlinks every ballot from the transaction of its delegate, and keeps what is on the ballots', async () => {
            const [A, B, C] = election.ballot.map((option) => option.id);
            await castBallots(election.voting.id, delegates[0], [[A, B], [C]]);
            await castBallots(election.voting.id, delegates[1], [[A], []]);
            await castBallots(election.voting.id, delegates[2], [[B, C]]);

            // While the election is open, anyone who can read the tables links each ballot to a delegate.
            expect(await linkByTransaction(election.voting.id)).toEqual({ ballots: 5, linked: 5, transactions: 3 });
            const before = await contents(election.voting.id);

            await query("UPDATE votings SET status = 'closed', closed_at = now(), closes_at = now() WHERE id = $1", [election.voting.id]);

            // After closing, all ballots were written again by the one closing transaction, in random order.
            expect(await linkByTransaction(election.voting.id)).toEqual({ ballots: 5, linked: 0, transactions: 1 });
            expect(await contents(election.voting.id)).toEqual(before);
            expect(await ballotBox(election.voting.id)).toEqual({ ballots: 5, marks: 6, counted: 5, body_votes_cast: 5 });
        });

        test('refuses a ballot after closing', async () => {
            await query("UPDATE votings SET status = 'closed', closed_at = now(), closes_at = now() WHERE id = $1", [election.voting.id]);
            expect(await refusalOf(query('INSERT INTO voting_ballots (id, voting_id) VALUES ($1, $2)', [crypto.randomUUID(), election.voting.id])))
                .toEqual('voting_not_open');
        });
    });

    test('deletes an election with its ballots, as deleting its event does', async () => {
        const [A] = election.ballot.map((option) => option.id);
        await castBallots(election.voting.id, delegates[0], [[A], []]);
        await castBallots(other.voting.id, delegates[3], [[other.ballot[0].id]]);

        await query("DELETE FROM votings WHERE kind = 'election'");

        const [left] = await query(`
            SELECT (SELECT count(*) FROM voting_ballots) AS ballots,
                   (SELECT count(*) FROM voting_ballot_marks) AS marks,
                   (SELECT count(*) FROM voting_options) AS options
        `);
        expect(left).toEqual({ ballots: 0, marks: 0, options: 0 });
    });
});
