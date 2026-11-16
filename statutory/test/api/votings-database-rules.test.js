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
