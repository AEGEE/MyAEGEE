const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { VotesPerAntenna, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

describe('Votings: my vote', () => {
    let event;
    let delegates;
    let stubs;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    // Body 34 has 5 votes and 3 delegates (users 10, 11 and 12): minimum 1, 2 extra votes.
    beforeEach(async () => {
        stubs = mock.mockAll({ core: { userFromToken: true } });
        event = await generator.createEvent({ type: 'agora', applications: [] });
        await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
        delegates = [];
        for (const userId of [10, 11, 12]) {
            delegates.push(await generator.createPresentDelegate({ user_id: userId, body_id: 34 }, event));
        }
    });

    afterEach(async () => {
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    const openVoting = async (options = {}) => {
        // Opens a second ago: the first request that reads the voting opens it.
        const voting = await generator.createVoting({
            opens_at: new Date(Date.now() - 1000),
            closes_at: new Date(Date.now() + 3600 * 1000),
            ...options
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

    const myVote = (method, voting, userId, body, eventId = event.id) => request({
        path: '/events/' + eventId + '/votings/' + voting.id + '/my-vote',
        method,
        headers: { 'X-Auth-Token': 'user-' + userId },
        body
    });

    describe('reading', () => {
        test('should show how many votes the delegate can cast', async () => {
            const voting = await openVoting({ title: 'Activity Plan', kind: 'proposal', majority: 'absolute' });

            const res = await myVote('GET', voting, 10);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({
                voting: {
                    id: voting.id,
                    event_id: event.id,
                    kind: 'proposal',
                    title: 'Activity Plan',
                    description: voting.description,
                    majority: 'absolute',
                    opens_at: new Date(voting.opens_at).toISOString(),
                    closes_at: new Date(voting.closes_at).toISOString(),
                    status: 'open'
                },
                body: { body_id: 34, votes_total: 5, delegates_count: 3, votes_cast: 0 },
                body_id: 34,
                max_votes: 2,
                votes_available: 2,
                in_favour: 0,
                against: 0,
                abstention: 0,
                submitted_at: null
            });
        });

        test('should show fewer votes when others used the extra votes', async () => {
            const voting = await openVoting();
            await myVote('PUT', voting, 10, { in_favour: 2 });
            await myVote('PUT', voting, 11, { against: 2 });

            const res = await myVote('GET', voting, 12);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.max_votes).toEqual(2);
            expect(res.body.data.votes_available).toEqual(1);
            // The delegate sees how many votes the own body cast, not what the others voted.
            expect(res.body.data.body).toEqual({ body_id: 34, votes_total: 5, delegates_count: 3, votes_cast: 4 });
            expect(res.body.data.in_favour).toEqual(0);
        });

        test('should show no votes available on a closed voting', async () => {
            const voting = await openVoting();
            await generator.closeVoting(voting);

            const res = await myVote('GET', voting, 10);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.votes_available).toEqual(0);
            expect(res.body.data.voting.status).toEqual('closed');
        });
    });

    describe('voting', () => {
        test('should store the vote once and update the counters of the body', async () => {
            const voting = await openVoting();

            const res = await myVote('PUT', voting, 10, { in_favour: 1, against: 1 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ in_favour: 1, against: 1, abstention: 0, votes_available: 0 });
            expect(res.body.data.submitted_at).not.toEqual(null);

            const body = await VotingBodyAllotment.findOne({ where: { voting_id: voting.id, body_id: 34 } });
            expect(body.votes_cast).toEqual(2);
            expect(body.delegates_above_min).toEqual(1);
        });

        test('should not accept a second vote', async () => {
            const voting = await openVoting();
            await myVote('PUT', voting, 10, { in_favour: 1 });

            const res = await myVote('PUT', voting, 10, { against: 1 });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain('already voted');
            const row = await VotingDelegateVote.findOne({ where: { voting_id: voting.id, user_id: 10 } });
            expect(row.in_favour).toEqual(1);
            expect(row.against).toEqual(0);
        });

        test('should not accept more votes than the delegate has', async () => {
            const voting = await openVoting();

            const res = await myVote('PUT', voting, 10, { in_favour: 2, abstention: 1 });

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toContain('at most 2 votes');
        });

        test('should tell how many votes the body has left', async () => {
            const voting = await openVoting();
            await myVote('PUT', voting, 10, { in_favour: 2 });
            await myVote('PUT', voting, 11, { in_favour: 2 });

            const refused = await myVote('PUT', voting, 12, { in_favour: 2 });
            expect(refused.statusCode).toEqual(409);
            expect(refused.body.message).toEqual('Your body has only 1 of its 5 votes left.');

            const accepted = await myVote('PUT', voting, 12, { abstention: 1 });
            expect(accepted.statusCode).toEqual(200);
        });

        test('should tell when the extra vote is already used', async () => {
            await VotesPerAntenna.update({ votes: 4 }, { where: { event_id: event.id, body_id: 34 } });
            const voting = await openVoting();
            await myVote('PUT', voting, 10, { in_favour: 2 });

            const res = await myVote('PUT', voting, 11, { in_favour: 2 });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain('at most 1 votes');
        });

        test.each([
            [{ in_favour: 0, against: 0, abstention: 0 }, 'at least one vote'],
            [{}, 'at least one vote'],
            [{ in_favour: -1, against: 2 }, 'in_favour'],
            [{ against: 1.5 }, 'against'],
            [{ abstention: '1' }, 'abstention'],
            [{ in_favour: null }, 'in_favour']
        ])('should refuse the invalid input %j', async (body, message) => {
            const voting = await openVoting();

            const res = await myVote('PUT', voting, 10, body);

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toContain(message);
            const row = await VotingDelegateVote.findOne({ where: { voting_id: voting.id, user_id: 10 } });
            expect(row.submitted_at).toEqual(null);
        });

        test('should not accept a vote after the voting closed', async () => {
            const voting = await openVoting();
            await generator.closeVoting(voting);

            const res = await myVote('PUT', voting, 10, { in_favour: 1 });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toEqual('This voting is closed.');
        });

        test('should not accept a vote after closes_at, also before the voting is marked closed', async () => {
            const voting = await openVoting();
            await generator.endVotingTime(voting); // closes_at passed, no job or request closed it yet

            const res = await myVote('PUT', voting, 10, { in_favour: 1 });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toEqual('This voting is closed.');
            const row = await VotingDelegateVote.findOne({ where: { voting_id: voting.id, user_id: 10 } });
            expect(row.submitted_at).toEqual(null);
        });

        test('should refuse a delegate who departed, without giving the votes to others', async () => {
            const voting = await openVoting();
            await delegates[0].update({ departed: true });

            const res = await myVote('PUT', voting, 10, { in_favour: 1 });
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('not a present delegate');

            const other = await myVote('GET', voting, 11);
            expect(other.body.data.max_votes).toEqual(2);
        });

        test('should refuse a user who was not a present delegate when the voting opened', async () => {
            const voting = await openVoting();
            await generator.createPresentDelegate({ user_id: 13, body_id: 34 }, event); // arrives later

            const late = await myVote('PUT', voting, 13, { in_favour: 1 });
            expect(late.statusCode).toEqual(403);

            const stranger = await myVote('GET', voting, 99);
            expect(stranger.statusCode).toEqual(403);
        });
    });

    describe('finding the voting', () => {
        test('should find the event by its URL', async () => {
            const voting = await openVoting();

            const res = await myVote('GET', voting, 10, undefined, event.url);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.voting.id).toEqual(voting.id);
        });

        test('should return 404 for an unknown event', async () => {
            const voting = await openVoting();

            const res = await myVote('GET', voting, 10, undefined, 'no-such-event');

            expect(res.statusCode).toEqual(404);
        });

        test('should return 404 for a voting of another event', async () => {
            const voting = await openVoting();
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await myVote('GET', voting, 10, undefined, otherEvent.id);

            expect(res.statusCode).toEqual(404);
        });

        test('should return 404 for a voting that did not open yet', async () => {
            const voting = await generator.createVoting({}, event);

            const res = await myVote('PUT', voting, 10, { in_favour: 1 });

            expect(res.statusCode).toEqual(404);
        });

        test('should return 400 for an invalid voting ID', async () => {
            const res = await myVote('GET', { id: 'abc' }, 10);

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('calls to core', () => {
        const countRequests = (scope) => {
            const counter = { count: 0 };
            scope.on('request', () => { counter.count++; });
            return counter;
        };

        test('should only ask core who the user is, once per request', async () => {
            const voting = await openVoting();
            const profileCalls = countRequests(stubs.coreStub);
            const permissionCalls = [stubs.mainPermissionsStub, stubs.approvePermissionsStub, stubs.memberslistPermissionsStub].map(countRequests);

            const res = await myVote('PUT', voting, 10, { in_favour: 1 });

            expect(res.statusCode).toEqual(200);
            expect(profileCalls.count).toEqual(1);
            expect(permissionCalls.map((counter) => counter.count)).toEqual([0, 0, 0]);
        });

        test('should ask core again after a failed login', async () => {
            const voting = await openVoting();
            stubs = mock.mockAll({ core: { unauthorized: true } });
            const profileCalls = countRequests(stubs.coreStub);

            const first = await myVote('GET', voting, 10);
            const second = await myVote('GET', voting, 10);

            expect(first.statusCode).toEqual(401);
            expect(second.statusCode).toEqual(401);
            expect(profileCalls.count).toEqual(2);
        });

        test('should return 500 when core returns garbage', async () => {
            const voting = await openVoting();
            mock.mockAll({ core: { badResponse: true } });

            const res = await myVote('GET', voting, 10);

            expect(res.statusCode).toEqual(500);
        });

        test('should return 500 when core returns an unsuccessful response', async () => {
            const voting = await openVoting();
            mock.mockAll({ core: { unsuccessfulResponse: true } });

            const res = await myVote('GET', voting, 10);

            expect(res.statusCode).toEqual(500);
        });
    });
});
