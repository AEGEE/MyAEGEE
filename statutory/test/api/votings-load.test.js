const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

// Load test: 400 delegates (80 bodies with 3 delegates, 80 bodies with 2) all submit their vote
// at the same moment, which is harder than the expected peak of 400 votes in 30 seconds.
// Every delegate asks for the most votes a delegate of the body can have, so the bodies with
// extra votes also see refusals.
//
// Measured on a laptop (Apple M-series, Postgres in Docker, default Sequelize pool of 5 connections),
// 3 runs each: all 400 votes done in 0.66-0.74 s, p95 latency of one vote 0.62-0.71 s,
// on both Postgres 17.6 and 10.18. Core is mocked here, so the time core needs to answer
// GET /members/me comes on top of this in production.
// Set VOTINGS_LOAD_REPORT to print the numbers of a run.
// The limit below leaves room for slower CI machines.
const BODIES_WITH_THREE = 80;
const BODIES_WITH_TWO = 80;
const P95_LIMIT_MS = 5000;

describe('Votings load', () => {
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

    test('400 delegates vote at the same moment within the latency limit and the division rule', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const delegates = [];
        let userId = 10000;
        for (let index = 0; index < BODIES_WITH_THREE + BODIES_WITH_TWO; index++) {
            const bodyId = 1000 + index;
            const delegatesCount = index < BODIES_WITH_THREE ? 3 : 2;
            await VotesPerAntenna.create({ event_id: event.id, body_id: bodyId, votes: 1 + (index % 14) });

            for (let order = 1; order <= delegatesCount; order++) {
                userId += 1;
                await generator.createPresentDelegate({ user_id: userId, body_id: bodyId, participant_order: order }, event);
                delegates.push({ userId, bodyId });
            }
        }
        expect(delegates.length).toEqual(400);

        const voting = await generator.createVoting({}, event);
        const openRes = await request({
            path: '/events/' + event.id + '/votings/' + voting.id + '/open',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' }
        });
        expect(openRes.statusCode).toEqual(200);

        const bodies = await VotingBodyAllotment.findAll({ where: { voting_id: voting.id } });
        const maxVotesPerBody = new Map(bodies.map((body) => [body.body_id, body.min_votes + (body.extra_votes > 0 ? 1 : 0)]));

        const started = Date.now();
        const results = await Promise.all(delegates.map(async (delegate) => {
            const requestStarted = Date.now();
            const res = await request({
                path: '/events/' + event.id + '/votings/' + voting.id + '/my-vote',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'user-' + delegate.userId },
                body: { in_favour: maxVotesPerBody.get(delegate.bodyId) }
            });
            return { statusCode: res.statusCode, ms: Date.now() - requestStarted };
        }));
        const totalMs = Date.now() - started;

        const latencies = results.map((result) => result.ms).sort((a, b) => a - b);
        const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1)];
        const statuses = results.reduce((acc, result) => ({ ...acc, [result.statusCode]: (acc[result.statusCode] || 0) + 1 }), {});

        if (process.env.VOTINGS_LOAD_REPORT) {
            // eslint-disable-next-line no-console
            console.info(JSON.stringify({ totalMs, p50: percentile(50), p95: percentile(95), max: latencies[latencies.length - 1], statuses }));
        }

        expect(Object.keys(statuses).every((code) => ['200', '409', '422'].includes(code))).toEqual(true);
        expect(percentile(95)).toBeLessThan(P95_LIMIT_MS);

        // The division rule still holds for every body.
        const storedBodies = await VotingBodyAllotment.findAll({ where: { voting_id: voting.id } });
        const delegateVotes = await VotingDelegateVote.findAll({ where: { voting_id: voting.id } });
        for (const body of storedBodies) {
            const totals = delegateVotes
                .filter((row) => row.body_id === body.body_id)
                .map((row) => row.in_favour + row.against + row.abstention);
            const sum = totals.reduce((acc, val) => acc + val, 0);

            expect(sum).toEqual(body.votes_cast);
            expect(sum).toBeLessThanOrEqual(body.votes_total);
            expect(totals.filter((total) => total > body.min_votes).length).toBeLessThanOrEqual(body.extra_votes);
        }
    }, 120000);
});
