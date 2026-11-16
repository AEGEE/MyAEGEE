const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { VotingBodyAllotment, VotingDelegateVote } = require('../../models');

// The division rule lives in the database itself (trigger count_delegate_votes and CHECK
// constraints), so it also holds for writes that do not go through the API.
// These tests write to the tables directly and expect the database to refuse.
describe('Votings database rules', () => {
    let event;
    let voting;
    let delegates;

    // A body with 4 votes and 3 delegates: minimum 1, 1 extra vote, so each delegate at most 2.
    beforeEach(async () => {
        event = await generator.createEvent({ type: 'agora', applications: [] });
        voting = await generator.createVoting({ status: 'open', opens_at: new Date(Date.now() - 1000), closes_at: new Date(Date.now() + 3600 * 1000) }, event);
        delegates = [];
        for (let index = 0; index < 3; index++) {
            delegates.push(await generator.createPresentDelegate({ user_id: 100 + index, body_id: 1 }, event));
        }

        await VotingBodyAllotment.create({ voting_id: voting.id, body_id: 1, votes_total: 4, min_votes: 1, extra_votes: 1 });
        for (const delegate of delegates) {
            await VotingDelegateVote.create({
                voting_id: voting.id,
                application_id: delegate.id,
                user_id: delegate.user_id,
                body_id: 1,
                max_votes: 2
            });
        }
    });

    afterEach(async () => {
        cron.clearAll();
        await generator.clearAll();
    });

    const castVotes = (delegate, counts) => VotingDelegateVote.update(counts, {
        where: { voting_id: voting.id, application_id: delegate.id }
    });

    const refusalOf = async (promise) => {
        try {
            await promise;
        } catch (err) {
            return err.parent.constraint;
        }
        throw new Error('The database accepted the write.');
    };

    const bodyRow = () => VotingBodyAllotment.findOne({ where: { voting_id: voting.id, body_id: 1 } });

    test('keeps the counters of the body in step with the votes', async () => {
        await castVotes(delegates[0], { in_favour: 1, against: 1 });
        await castVotes(delegates[1], { abstention: 1 });

        const body = await bodyRow();
        expect(body.votes_cast).toEqual(3);
        expect(body.delegates_above_min).toEqual(1);

        const row = await VotingDelegateVote.findOne({ where: { voting_id: voting.id, application_id: delegates[0].id } });
        expect(row.submitted_at).not.toEqual(null);
    });

    test('refuses more than the minimum plus one for a delegate (rule 2)', async () => {
        expect(await refusalOf(castVotes(delegates[0], { in_favour: 3 }))).toEqual('delegate_vote_limit');
        expect((await bodyRow()).votes_cast).toEqual(0);
    });

    test('refuses a second extra vote when there is only one (rule 3)', async () => {
        await castVotes(delegates[0], { in_favour: 2 });
        expect(await refusalOf(castVotes(delegates[1], { in_favour: 2 }))).toEqual('extra_vote_limit');
        expect((await bodyRow()).votes_cast).toEqual(2);
    });

    test('refuses more votes than the body has (rule 1)', async () => {
        await VotingBodyAllotment.update({ votes_total: 3 }, { where: { voting_id: voting.id, body_id: 1 } });
        await castVotes(delegates[0], { in_favour: 2 });
        await castVotes(delegates[1], { in_favour: 1 });

        expect(await refusalOf(castVotes(delegates[2], { in_favour: 1 }))).toEqual('body_vote_limit');
        expect((await bodyRow()).votes_cast).toEqual(3);
    });

    test('refuses a direct change of votes_cast, so the body limit still holds', async () => {
        await castVotes(delegates[0], { in_favour: 2 });
        await castVotes(delegates[1], { in_favour: 1 });

        const resetCounter = VotingBodyAllotment.update({ votes_cast: 0 }, { where: { voting_id: voting.id, body_id: 1 } });
        expect(await refusalOf(resetCounter)).toEqual('counters_are_derived');

        expect(await refusalOf(castVotes(delegates[2], { in_favour: 2 }))).toEqual('body_vote_limit');
        expect((await bodyRow()).votes_cast).toEqual(3);
    });

    test('refuses a direct change of delegates_above_min, so the extra vote limit still holds', async () => {
        await castVotes(delegates[0], { in_favour: 2 });

        const resetCounter = VotingBodyAllotment.update({ delegates_above_min: 0 }, { where: { voting_id: voting.id, body_id: 1 } });
        expect(await refusalOf(resetCounter)).toEqual('counters_are_derived');

        expect(await refusalOf(castVotes(delegates[1], { in_favour: 2 }))).toEqual('extra_vote_limit');
        expect((await bodyRow()).delegates_above_min).toEqual(1);
    });

    test('refuses a body row that is created with counters above zero', async () => {
        expect(await refusalOf(VotingBodyAllotment.create({
            voting_id: voting.id, body_id: 2, votes_total: 4, min_votes: 1, extra_votes: 1, votes_cast: 1
        }))).toEqual('counters_are_derived');
        expect(await refusalOf(VotingBodyAllotment.create({
            voting_id: voting.id, body_id: 2, votes_total: 4, min_votes: 1, extra_votes: 1, delegates_above_min: 1
        }))).toEqual('counters_are_derived');
    });

    test('refuses a second vote of the same delegate', async () => {
        await castVotes(delegates[0], { in_favour: 1 });
        expect(await refusalOf(castVotes(delegates[0], { against: 1 }))).toEqual('already_voted');
        expect((await bodyRow()).votes_cast).toEqual(1);
    });

    test('refuses a vote when the voting is not open', async () => {
        await voting.update({ status: 'closed' });
        expect(await refusalOf(castVotes(delegates[0], { in_favour: 1 }))).toEqual('voting_not_open');
    });

    test('refuses a vote after closes_at, also while the voting is still marked open', async () => {
        await generator.endVotingTime(voting);
        expect((await voting.reload()).status).toEqual('open');

        expect(await refusalOf(castVotes(delegates[0], { in_favour: 1 }))).toEqual('voting_not_open');
    });

    test('refuses a vote of a delegate who departed after the voting opened', async () => {
        await delegates[0].update({ departed: true });
        expect(await refusalOf(castVotes(delegates[0], { in_favour: 1 }))).toEqual('delegate_not_present');
    });

    test('refuses a vote of a delegate who was cancelled after the voting opened', async () => {
        await VotingDelegateVote.sequelize.query('UPDATE applications SET cancelled = true WHERE id = :id', {
            replacements: { id: delegates[0].id }
        });
        expect(await refusalOf(castVotes(delegates[0], { in_favour: 1 }))).toEqual('delegate_not_present');
    });

    test('refuses to change the snapshot of a delegate', async () => {
        expect(await refusalOf(castVotes(delegates[0], { max_votes: 4 }))).toEqual('snapshot_is_fixed');
        expect(await refusalOf(castVotes(delegates[0], { body_id: 2 }))).toEqual('snapshot_is_fixed');
    });

    test('refuses a delegate row that is created with votes', async () => {
        const delegate = await generator.createPresentDelegate({ user_id: 200, body_id: 1 }, event);
        expect(await refusalOf(VotingDelegateVote.create({
            voting_id: voting.id,
            application_id: delegate.id,
            user_id: delegate.user_id,
            body_id: 1,
            max_votes: 2,
            in_favour: 2
        }))).toEqual('votes_start_empty');
    });
});

// The rules of a Pre-Agora voting also live in the database: who can vote, the two-thirds
// majority, the quorum numbers, the publication at closing and the shape of the outcome.
describe('Votings database rules: Pre-Agora Voting', () => {
    let event;
    let votingId;
    let delegate;

    const refusalOf = async (promise) => {
        try {
            await promise;
        } catch (err) {
            return err.parent.constraint;
        }
        throw new Error('The database accepted the write.');
    };

    const query = (sql, replacements = {}) => VotingDelegateVote.sequelize.query(sql, { replacements: { id: votingId, ...replacements } });

    // An open Pre-Agora voting in a network of 4 Antennae (quorum 2), with one delegate
    // of the coming Agora who is not checked in, and a body with 2 votes.
    beforeEach(async () => {
        event = await generator.createEvent({ type: 'agora', applications: [] });
        const [[row]] = await VotingDelegateVote.sequelize.query(`
            INSERT INTO votings (event_id, kind, title, majority, phase, opens_at, closes_at, status, opened_at,
                antennae_total, quorum_required, created_at, updated_at)
            VALUES (:eventId, 'proposal', 'Activity Plan', 'two_thirds', 'pre_agora', now() - interval '1 second',
                now() + interval '1 hour', 'open', now(), 4, 2, now(), now())
            RETURNING id
        `, { replacements: { eventId: event.id } });
        votingId = row.id;

        delegate = await generator.createUpcomingDelegate({ user_id: 100, body_id: 1 }, event);
        await VotingBodyAllotment.create({ voting_id: votingId, body_id: 1, votes_total: 2, min_votes: 2, extra_votes: 0 });
        await VotingDelegateVote.create({ voting_id: votingId, application_id: delegate.id, user_id: 100, body_id: 1, max_votes: 2 });
    });

    afterEach(async () => {
        cron.clearAll();
        await generator.clearAll();
    });

    const castVotes = (counts) => VotingDelegateVote.update(counts, {
        where: { voting_id: votingId, application_id: delegate.id }
    });

    // The closing as the lifecycle does it (counted, quorum known, outcome set, and published),
    // with some columns set to other SQL values.
    const closeWith = (changes) => {
        const columns = {
            status: "'closed'",
            closed_at: 'now()',
            result: "'accepted'",
            antennae_voted: '2',
            quorum_reached: 'true',
            outcome: "'decided'",
            outcome_reason: 'NULL',
            published: 'true',
            published_at: 'now()',
            ...changes
        };
        const assignments = Object.entries(columns).map(([column, value]) => `${column} = ${value}`).join(', ');
        return query(`UPDATE votings SET ${assignments} WHERE id = :id`);
    };

    test('accepts a vote of a delegate who is not checked in', async () => {
        await castVotes({ in_favour: 2 });

        expect((await VotingBodyAllotment.findOne({ where: { voting_id: votingId } })).votes_cast).toEqual(2);
    });

    test.each([
        ['cancelled', 'cancelled = true'],
        ['not accepted any more', "status = 'rejected'"],
        ['not confirmed any more', 'confirmed = false']
    ])('refuses a vote of a delegate whose application is %s', async (name, change) => {
        await query(`UPDATE applications SET ${change} WHERE id = :applicationId`, { applicationId: delegate.id });

        expect(await refusalOf(castVotes({ in_favour: 1 }))).toEqual('delegate_withdrawn');
    });

    test('refuses a majority other than two thirds', async () => {
        expect(await refusalOf(query("UPDATE votings SET majority = 'simple' WHERE id = :id"))).toEqual('pre_agora_majority');
    });

    test('refuses an open voting without the number of Antennae', async () => {
        expect(await refusalOf(query('UPDATE votings SET antennae_total = NULL, quorum_required = NULL WHERE id = :id'))).toEqual('quorum_base_when_opened');
    });

    test('refuses a quorum that is not half of the Antennae, rounded up', async () => {
        expect(await refusalOf(query('UPDATE votings SET quorum_required = 1 WHERE id = :id'))).toEqual('quorum_is_half');
        expect(await refusalOf(query('UPDATE votings SET antennae_total = 5 WHERE id = :id'))).toEqual('quorum_is_half');
        await query('UPDATE votings SET antennae_total = 3 WHERE id = :id');
    });

    test('refuses to close without publishing the result', async () => {
        expect(await refusalOf(closeWith({ published: 'false', published_at: 'NULL' }))).toEqual('pre_agora_closed');
    });

    test('refuses to close without the quorum and the outcome', async () => {
        expect(await refusalOf(closeWith({ antennae_voted: 'NULL', quorum_reached: 'NULL' }))).toEqual('pre_agora_closed');
        expect(await refusalOf(closeWith({ outcome: 'NULL' }))).toEqual('pre_agora_closed');
    });

    test('refuses a quorum_reached that does not follow from the numbers', async () => {
        expect(await refusalOf(closeWith({ antennae_voted: '1' }))).toEqual('quorum_reached_matches');
    });

    test('refuses an outcome without its reason, or a decided outcome with a reason', async () => {
        expect(await refusalOf(closeWith({ outcome: "'to_agora'" }))).toEqual('outcome_reason_matches');
        expect(await refusalOf(closeWith({ outcome_reason: "'rejected'" }))).toEqual('outcome_reason_matches');
        await closeWith({ outcome: "'to_agora'", outcome_reason: "'amendment'" });
    });

    test('refuses a Pre-Agora voting that follows another voting', async () => {
        expect(await refusalOf(query('UPDATE votings SET follows_voting_id = id WHERE id = :id'))).toEqual('follows_only_on_agora');
    });

    test('refuses the fields of Pre-Agora Voting on a voting on the Agora', async () => {
        expect(await refusalOf(query("UPDATE votings SET phase = 'agora' WHERE id = :id"))).toEqual('pre_agora_fields');
        expect(await refusalOf(query(`
            UPDATE votings SET phase = 'agora', antennae_total = NULL, quorum_required = NULL, concerns_statutes = true WHERE id = :id
        `))).toEqual('pre_agora_fields');
        await query("UPDATE votings SET phase = 'agora', antennae_total = NULL, quorum_required = NULL WHERE id = :id");
    });
});
