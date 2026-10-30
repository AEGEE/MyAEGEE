const lodash = require('lodash');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { VotesPerAntenna, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

// Acceptance test for the race that the old OMS JC module had: it first checked how many votes
// were left and then inserted the vote without a lock, so delegates of one body who voted
// at the same time could cast more votes than the body has.
// Here every round opens a fresh voting and sends all votes of one body at the same time.
// The same rounds run for a voting on the Agora (checked-in delegates) and for a Pre-Agora voting
// (delegates of the coming Agora who are not checked in yet), because both use the same rule in the database.
const ROUNDS = 20;
const BODY_ID = 34;
const ACCEPTED_STATUSES = [200, 409, 422];

// One server for both phases: stopping and starting it again between them can make the next
// request reuse a connection of the stopped server.
beforeAll(async () => {
    await startServer();
});

afterAll(async () => {
    await stopServer();
});

describe.each([
    ['agora', () => generator.createEvent({ type: 'agora', applications: [] }), generator.createPresentDelegate],
    ['pre_agora', () => generator.createAgoraStartingIn(10), generator.createUpcomingDelegate]
])('Votings concurrency, phase %s', (phase, createAgora, createDelegate) => {
    let event;

    beforeEach(async () => {
        mock.mockAll({ core: { userFromToken: true } });
    });

    afterEach(async () => {
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    const setUpBody = async ({ votes, delegates }) => {
        event = await createAgora();
        await VotesPerAntenna.create({ event_id: event.id, body_id: BODY_ID, votes });

        const userIds = [];
        for (let index = 0; index < delegates; index++) {
            const userId = 1000 + index;
            await createDelegate({ user_id: userId, body_id: BODY_ID, participant_order: index + 1 }, event);
            userIds.push(userId);
        }

        return userIds;
    };

    const openVoting = async () => {
        // Opens a second ago: the first request that reads the voting opens it.
        const voting = await generator.createVoting({
            phase,
            opens_at: new Date(Date.now() - 1000),
            closes_at: new Date(Date.now() + 3600 * 1000),
        }, event);
        const res = await request({
            path: '/events/' + event.id + '/votings/' + voting.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('open');
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

// The same race for an election: each vote is a set of ballots, stored in the ballot box in the same
// transaction as the counter on the row of the delegate. On top of the division rule, the ballot box
// must always hold exactly as many ballots as the delegates counted (constraint ballots_match_votes).
describe('Votings concurrency, elections', () => {
    let event;

    beforeEach(async () => {
        mock.mockAll({ core: { userFromToken: true } });
        event = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    // Bodies 1, 2, ... with the given votes, each with the given number of delegates.
    const setUpBodies = async (bodies) => {
        const delegates = [];
        let userId = 1000;
        for (const [index, { votes, delegates: count }] of bodies.entries()) {
            await VotesPerAntenna.create({ event_id: event.id, body_id: index + 1, votes });
            for (let order = 1; order <= count; order++) {
                await generator.createPresentDelegate({ user_id: userId, body_id: index + 1, participant_order: order }, event);
                delegates.push({ userId, bodyId: index + 1 });
                userId++;
            }
        }
        return delegates;
    };

    const openElection = async () => {
        const election = await generator.createElection({
            opens_at: new Date(Date.now() - 1000),
            closes_at: new Date(Date.now() + 3600 * 1000)
        }, event, { candidatesCount: 4 });
        const res = await request({
            path: '/events/' + event.id + '/votings/' + election.voting.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });
        expect(res.body.data.status).toEqual('open');
        return election;
    };

    // A ballot with 0, 1 or 2 of the candidates marked (2 seats).
    const randomBallot = (election) => lodash.shuffle(election.ballot.map((option) => option.id)).slice(0, lodash.random(0, 2));

    const castBallots = (election, userId, count) => request({
        path: '/events/' + event.id + '/votings/' + election.voting.id + '/my-vote',
        method: 'PUT',
        headers: { 'X-Auth-Token': 'user-' + userId },
        body: { ballots: Array.from({ length: count }, () => randomBallot(election)) }
    });

    const checkElection = async (election) => {
        const [[box]] = await VotingDelegateVote.sequelize.query(`
            SELECT (SELECT count(*) FROM voting_ballots WHERE voting_id = :id) AS ballots,
                   (SELECT COALESCE(sum(ballots_cast), 0) FROM voting_delegate_votes WHERE voting_id = :id) AS counted
        `, { replacements: { id: election.voting.id } });
        const bodyRows = await VotingBodyAllotment.findAll({ where: { voting_id: election.voting.id } });
        const delegateRows = await VotingDelegateVote.findAll({ where: { voting_id: election.voting.id } });

        const broken = bodyRows.filter((bodyRow) => {
            const totals = delegateRows.filter((row) => row.body_id === bodyRow.body_id).map((row) => row.ballots_cast);
            const sum = totals.reduce((acc, val) => acc + val, 0);
            return sum > bodyRow.votes_total
                || totals.some((total) => total > bodyRow.min_votes + 1)
                || totals.filter((total) => total > bodyRow.min_votes).length > bodyRow.extra_votes
                || bodyRow.votes_cast !== sum;
        });

        return { box, brokenBodies: broken.map((bodyRow) => bodyRow.body_id) };
    };

    const runRounds = async (bodies, makeRequests) => {
        const delegates = await setUpBodies(bodies);
        const failures = [];
        const statuses = {};

        for (let round = 0; round < ROUNDS; round++) {
            const election = await openElection();
            const responses = await Promise.all(makeRequests(election, delegates));
            for (const res of responses) {
                statuses[res.statusCode] = (statuses[res.statusCode] || 0) + 1;
            }

            const state = await checkElection(election);
            if (state.box.ballots !== state.box.counted || state.brokenBodies.length > 0) {
                failures.push(state);
            }
        }

        return { failures, statuses };
    };

    test('5 votes, 3 delegates, all cast 2 ballots at once: never more than 5 ballots', async () => {
        const { failures, statuses } = await runRounds([{ votes: 5, delegates: 3 }], (election, delegates) => delegates.map(
            ({ userId }) => castBallots(election, userId, 2)
        ));

        expect(failures).toEqual([]);
        expect(statuses[200]).toEqual(2 * ROUNDS);
        expect(statuses[409]).toEqual(ROUNDS);
    }, 60000);

    test('4 votes, 3 delegates, two cast 2 ballots at once: only one gets the extra vote', async () => {
        const { failures, statuses } = await runRounds([{ votes: 4, delegates: 3 }], (election, delegates) => delegates.slice(0, 2).map(
            ({ userId }) => castBallots(election, userId, 2)
        ));

        expect(failures).toEqual([]);
        expect(statuses[200]).toEqual(ROUNDS);
        expect(statuses[409]).toEqual(ROUNDS);
    }, 60000);

    test('one delegate casts 2 ballots from 4 tabs at once: only one set of ballots counts', async () => {
        const { failures, statuses } = await runRounds([{ votes: 5, delegates: 3 }], (election, delegates) => Array.from(
            { length: 4 },
            () => castBallots(election, delegates[0].userId, 2)
        ));

        expect(failures).toEqual([]);
        expect(statuses[200]).toEqual(ROUNDS);
        expect(statuses[409]).toEqual(3 * ROUNDS);
    }, 60000);

    test('4 bodies of 3 delegates, everybody at once with the most ballots: the ballot box always matches', async () => {
        const bodies = [{ votes: 3, delegates: 3 }, { votes: 4, delegates: 3 }, { votes: 5, delegates: 3 }, { votes: 7, delegates: 3 }];
        const { failures, statuses } = await runRounds(bodies, (election, delegates) => delegates.map(
            ({ userId, bodyId }) => castBallots(election, userId, Math.ceil(bodies[bodyId - 1].votes / 3))
        ));

        expect(failures).toEqual([]);
        expect(Object.keys(statuses).map(Number).every((code) => ACCEPTED_STATUSES.includes(code))).toEqual(true);
        // Per round: body 1 (max 1) all 3; body 2 (max 2, 1 extra) 1; body 3 (max 2, 2 extra) 2; body 4 (max 3, 1 extra) 1.
        expect(statuses[200]).toEqual(7 * ROUNDS);
    }, 60000);
});
