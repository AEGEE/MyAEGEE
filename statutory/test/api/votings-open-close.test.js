const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { sequelize } = require('../../lib/sequelize');
const { VotesPerAntenna, Voting, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

describe('Votings opening and closing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const call = (method, path, body) => request({
        path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const castVotes = (votingId, application, counts) => VotingDelegateVote.update(counts, {
        where: { voting_id: votingId, application_id: application.id }
    });

    describe('opening', () => {
        test('should take a snapshot of the present delegates and the votes of their bodies', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 50, votes: 3 }); // no delegates, so no row

            const present = [];
            for (let index = 0; index < 3; index++) {
                present.push(await generator.createPresentDelegate({ user_id: 10 + index, body_id: 34, participant_order: index + 1 }, event));
            }
            await generator.createPresentDelegate({ user_id: 20, body_id: 34, departed: true }, event);
            await generator.createPresentDelegate({ user_id: 21, body_id: 34, registered: false }, event);
            await generator.createPresentDelegate({ user_id: 22, body_id: 34, confirmed: false, registered: false }, event);
            await generator.createPresentDelegate({ user_id: 23, body_id: 34, participant_type: 'observer' }, event);
            const cancelled = await generator.createPresentDelegate({ user_id: 24, body_id: 34 }, event);
            await sequelize.query('UPDATE applications SET cancelled = true WHERE id = :id', { replacements: { id: cancelled.id } });
            const withoutVotes = await generator.createPresentDelegate({ user_id: 30, body_id: 9 }, event); // no votes_per_antenna

            const voting = await generator.createVoting({}, event);
            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('open');
            expect(res.body.data.opened_by).toEqual(1);
            expect(res.body.data.opened_at).not.toEqual(null);

            const bodies = await VotingBodyAllotment.findAll({ where: { voting_id: voting.id }, order: [['body_id', 'ASC']], raw: true });
            expect(bodies).toEqual([
                { voting_id: voting.id, body_id: 9, votes_total: 0, min_votes: 0, extra_votes: 0, votes_cast: 0, delegates_above_min: 0 },
                { voting_id: voting.id, body_id: 34, votes_total: 5, min_votes: 1, extra_votes: 2, votes_cast: 0, delegates_above_min: 0 }
            ]);

            const delegateVotes = await VotingDelegateVote.findAll({ where: { voting_id: voting.id }, order: [['user_id', 'ASC']] });
            expect(delegateVotes.map((row) => [row.user_id, row.application_id, row.body_id, row.max_votes])).toEqual([
                [10, present[0].id, 34, 2],
                [11, present[1].id, 34, 2],
                [12, present[2].id, 34, 2],
                [30, withoutVotes.id, 9, 0]
            ]);
            expect(delegateVotes.every((row) => row.submitted_at === null)).toEqual(true);
        });

        test('should keep the snapshot when the votes or the delegates change later', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const votes = await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 4 });
            const first = await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            await generator.createPresentDelegate({ user_id: 11, body_id: 34 }, event);

            const voting = await generator.createVoting({}, event);
            await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open');

            await votes.update({ votes: 10 });
            await first.update({ departed: true });
            await generator.createPresentDelegate({ user_id: 12, body_id: 34 }, event);

            const body = await VotingBodyAllotment.findOne({ where: { voting_id: voting.id, body_id: 34 } });
            expect(body.votes_total).toEqual(4);
            expect(body.min_votes).toEqual(2);
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(2);

            // The next voting takes a new snapshot.
            const nextVoting = await generator.createVoting({}, event);
            await call('PUT', '/events/' + event.id + '/votings/' + nextVoting.id + '/open');
            const nextBody = await VotingBodyAllotment.findOne({ where: { voting_id: nextVoting.id, body_id: 34 } });
            expect(nextBody.votes_total).toEqual(10);
            expect(nextBody.min_votes).toEqual(5);
            expect(await VotingDelegateVote.count({ where: { voting_id: nextVoting.id } })).toEqual(2);
        });

        test('should open a voting without any present delegates', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open');

            expect(res.statusCode).toEqual(200);
            expect(await VotingBodyAllotment.count({ where: { voting_id: voting.id } })).toEqual(0);

            const progress = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/progress');
            expect(progress.body.data).toMatchObject({ votes_total: 0, votes_cast: 0, votes_cast_percentage: 0 });
        });

        test('should not open a voting twice', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 2 });
            await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await generator.createVoting({}, event);

            const [first, second] = await Promise.all([
                call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open'),
                call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open')
            ]);

            expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(1);
        });

        test('should not open a closed voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ status: 'closed', result: 'rejected' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open');

            expect(res.statusCode).toEqual(409);
        });

        test('should not open without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ status: 'open' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open');

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('closing and the result', () => {
        // Two bodies: body 34 has 5 votes and 2 delegates, body 9 has 1 vote and 1 delegate.
        const openVotingWithDelegates = async (majority) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 9, votes: 1 });
            const delegates = [
                await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 11, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 12, body_id: 9 }, event)
            ];
            const voting = await generator.createVoting({ majority }, event);
            await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/open');
            return { event, voting, delegates };
        };

        test.each([
            ['simple', 'accepted'],
            ['absolute', 'rejected'],
            ['two_thirds', 'rejected']
        ])('should count the votes with a %s majority and store the result', async (majority, expected) => {
            const { event, voting, delegates } = await openVotingWithDelegates(majority);
            await castVotes(voting.id, delegates[0], { in_favour: 2, against: 1 });
            await castVotes(voting.id, delegates[1], { abstention: 2 });
            // in favour 2, against 1, abstention 2; the delegate of body 9 does not vote.

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('closed');
            expect(res.body.data.result).toEqual(expected);
            expect(res.body.data.closed_by).toEqual(1);
            expect(res.body.data.closed_at).not.toEqual(null);
        });

        test('should accept with a two thirds majority', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('two_thirds');
            await castVotes(voting.id, delegates[0], { in_favour: 3 });
            await castVotes(voting.id, delegates[1], { against: 1 });

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');

            expect(res.body.data.result).toEqual('accepted');
        });

        test('should show only who voted while the voting is open', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('simple');
            await castVotes(voting.id, delegates[0], { in_favour: 2, against: 1 });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/progress');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                votes_total: 6,
                votes_cast: 3,
                votes_cast_percentage: 50,
                bodies_available: 2,
                bodies_present: 1,
                bodies: [
                    {
                        body_id: 9,
                        votes_total: 1,
                        votes_cast: 0,
                        delegates_count: 1,
                        delegates_voted: 0,
                        delegates: [{ application_id: delegates[2].id, user_id: 12, voted: false }]
                    },
                    {
                        body_id: 34,
                        votes_total: 5,
                        votes_cast: 3,
                        delegates_count: 2,
                        delegates_voted: 1,
                        delegates: [
                            { application_id: delegates[0].id, user_id: 10, voted: true },
                            { application_id: delegates[1].id, user_id: 11, voted: false }
                        ]
                    }
                ]
            });
            expect(res.body.data.voting.id).toEqual(voting.id);
            for (const field of ['in_favour', 'against', 'abstention', 'result']) {
                expect(res.body.data).not.toHaveProperty(field);
            }
        });

        test('should not show the result while the voting is open', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('simple');
            await castVotes(voting.id, delegates[0], { in_favour: 2 });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(409);
            expect(res.body).not.toHaveProperty('data');
        });

        test('should show the count once the voting is closed', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('simple');
            await castVotes(voting.id, delegates[0], { in_favour: 2, against: 1 });
            await castVotes(voting.id, delegates[1], { abstention: 2 });
            await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                majority: 'simple',
                result: 'accepted',
                in_favour: 2,
                against: 1,
                abstention: 2,
                votes_cast: 5,
                votes_total: 6,
                bodies_available: 2,
                bodies_present: 1
            });
            expect(res.body.data.voting.id).toEqual(voting.id);
        });

        test('should wait for a vote that is being stored before it counts', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('simple');

            // A vote that is in the middle of being stored: its transaction is not committed yet.
            const transaction = await sequelize.transaction();
            await VotingDelegateVote.update({ in_favour: 1 }, {
                where: { voting_id: voting.id, application_id: delegates[2].id },
                transaction
            });

            let closed = false;
            const closing = call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close').then((res) => {
                closed = true;
                return res;
            });

            await new Promise((resolve) => { setTimeout(resolve, 500); });
            expect(closed).toEqual(false);

            await transaction.commit();
            const res = await closing;

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.result).toEqual('accepted'); // the vote in favour was counted
        });

        test('should not close a draft voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');

            expect(res.statusCode).toEqual(409);
            expect((await Voting.findByPk(voting.id)).status).toEqual('draft');
        });

        test('should not close a voting twice', async () => {
            const { event, voting } = await openVotingWithDelegates('simple');

            const first = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');
            const second = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');

            expect(first.statusCode).toEqual(200);
            expect(second.statusCode).toEqual(409);
        });

        test('should not close without the permission', async () => {
            const { event, voting } = await openVotingWithDelegates('simple');
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');

            expect(res.statusCode).toEqual(403);
        });

        test('should not show the progress without the permission', async () => {
            const { event, voting } = await openVotingWithDelegates('simple');
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/progress');

            expect(res.statusCode).toEqual(403);
        });

        test('should show the count without the permission once the voting is closed', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('simple');
            await castVotes(voting.id, delegates[0], { in_favour: 2, against: 1 });
            await castVotes(voting.id, delegates[1], { abstention: 2 });
            await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/close');
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                majority: 'simple',
                result: 'accepted',
                in_favour: 2,
                against: 1,
                abstention: 2,
                votes_cast: 5,
                votes_total: 6,
                bodies_available: 2,
                bodies_present: 1
            });
        });

        test('should not show the result without the permission while the voting is open', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates('simple');
            await castVotes(voting.id, delegates[0], { in_favour: 2 });
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(409);
            expect(res.body).not.toHaveProperty('data');
        });

        test.each(['progress', 'result'])('should hide the %s of a draft voting without the permission', async (route) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/' + route);

            expect(res.statusCode).toEqual(404);
        });

        test.each(['progress', 'result'])('should not show the %s of a draft voting', async (route) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/' + route);

            expect(res.statusCode).toEqual(409);
        });
    });
});
