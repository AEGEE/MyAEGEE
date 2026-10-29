const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

// Acceptance test for the race that the old OMS JC module had: it first checked how many votes
// were left and then inserted the vote without a lock, so delegates of one body who voted
// at the same time could cast more votes than the body has.
// Here every round opens a fresh voting and sends all votes of one body at the same time.
const ROUNDS = 20;
const BODY_ID = 34;
const ACCEPTED_STATUSES = [200, 409, 422];

describe('Votings concurrency', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ core: { userFromToken: true } });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const setUpBody = async ({ votes, delegates }) => {
        event = await generator.createEvent({ type: 'agora', applications: [] });
        await VotesPerAntenna.create({ event_id: event.id, body_id: BODY_ID, votes });

        const userIds = [];
        for (let index = 0; index < delegates; index++) {
            const userId = 1000 + index;
            await generator.createPresentDelegate({ user_id: userId, body_id: BODY_ID, participant_order: index + 1 }, event);
            userIds.push(userId);
        }

        return userIds;
    };

    const openVoting = async () => {
        const voting = await generator.createVoting({}, event);
        const res = await request({
            path: '/events/' + event.id + '/votings/' + voting.id + '/open',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' }
        });
        expect(res.statusCode).toEqual(200);
        return voting;
    };

    const vote = (voting, userId, body) => request({
        path: '/events/' + event.id + '/votings/' + voting.id + '/my-vote',
        method: 'PUT',
        headers: { 'X-Auth-Token': 'user-' + userId },
        body
    });

    // Checks the stored state of one voting against the division rule:
    // 1. all delegates together never cast more than the body has,
    // 2. no delegate casts more than the minimum plus one,
    // 3. no more delegates go above the minimum than there are extra votes,
    // and the body counter is equal to the sum of the delegate rows.
    const checkVoting = async (voting) => {
        const bodyRow = await VotingBodyAllotment.findOne({ where: { voting_id: voting.id, body_id: BODY_ID } });
        const delegateRows = await VotingDelegateVote.findAll({ where: { voting_id: voting.id } });
        const totals = delegateRows.map((row) => row.in_favour + row.against + row.abstention);
        const sum = totals.reduce((acc, val) => acc + val, 0);

        return {
            sum,
            totals,
            overBodyLimit: sum > bodyRow.votes_total,
            overDelegateLimit: totals.some((total) => total > bodyRow.min_votes + 1),
            overExtraLimit: totals.filter((total) => total > bodyRow.min_votes).length > bodyRow.extra_votes,
            counterMismatch: bodyRow.votes_cast !== sum
        };
    };

    const runRounds = async (votes, delegates, makeRequests) => {
        const userIds = await setUpBody({ votes, delegates });
        const failures = [];
        const statuses = {};

        for (let round = 0; round < ROUNDS; round++) {
            const voting = await openVoting();
            const responses = await Promise.all(makeRequests(voting, userIds));

            for (const res of responses) {
                statuses[res.statusCode] = (statuses[res.statusCode] || 0) + 1;
            }

            const state = await checkVoting(voting);
            if (state.overBodyLimit || state.overDelegateLimit || state.overExtraLimit || state.counterMismatch) {
                failures.push(state);
            }
        }

        return { failures, statuses };
    };

    test('3 votes, 2 delegates, both ask for the extra vote at once: never more than 3', async () => {
        const { failures, statuses } = await runRounds(3, 2, (voting, userIds) => userIds.map(
            (userId) => vote(voting, userId, { in_favour: 2, against: 0, abstention: 0 })
        ));

        expect(failures).toEqual([]);
        expect(Object.keys(statuses).map(Number).every((code) => ACCEPTED_STATUSES.includes(code))).toEqual(true);
        expect(statuses[200]).toEqual(ROUNDS); // one delegate wins the extra vote...
        expect(statuses[409]).toEqual(ROUNDS); // ...the other one is told there is no extra vote left
    }, 60000);

    test('5 votes, 3 delegates, all ask for 2 votes at once: never more than 5', async () => {
        const { failures, statuses } = await runRounds(5, 3, (voting, userIds) => userIds.map(
            (userId) => vote(voting, userId, { in_favour: 1, against: 1, abstention: 0 })
        ));

        expect(failures).toEqual([]);
        expect(Object.keys(statuses).map(Number).every((code) => ACCEPTED_STATUSES.includes(code))).toEqual(true);
        expect(statuses[200]).toEqual(2 * ROUNDS);
        expect(statuses[409]).toEqual(ROUNDS);
    }, 60000);

    test('4 votes, 3 delegates, two ask for the single extra vote at once: only one gets it', async () => {
        const { failures, statuses } = await runRounds(4, 3, (voting, userIds) => userIds.slice(0, 2).map(
            (userId) => vote(voting, userId, { in_favour: 0, against: 2, abstention: 0 })
        ));

        expect(failures).toEqual([]);
        expect(statuses[200]).toEqual(ROUNDS);
        expect(statuses[409]).toEqual(ROUNDS);
    }, 60000);

    test('one delegate submits from 4 tabs at once: only one submission counts', async () => {
        const { failures, statuses } = await runRounds(5, 3, (voting, userIds) => Array.from(
            { length: 4 },
            () => vote(voting, userIds[0], { in_favour: 2, against: 0, abstention: 0 })
        ));

        expect(failures).toEqual([]);
        expect(statuses[200]).toEqual(ROUNDS);
        expect(statuses[409]).toEqual(3 * ROUNDS);
    }, 60000);

    test('all 3 delegates of 5 votes submit from 3 tabs each, from zero: never more than 5', async () => {
        const { failures, statuses } = await runRounds(5, 3, (voting, userIds) => userIds.flatMap(
            (userId) => Array.from({ length: 3 }, () => vote(voting, userId, { in_favour: 0, against: 0, abstention: 2 }))
        ));

        expect(failures).toEqual([]);
        expect(Object.keys(statuses).map(Number).every((code) => ACCEPTED_STATUSES.includes(code))).toEqual(true);
        expect(statuses[200]).toEqual(2 * ROUNDS);
    }, 60000);
});
