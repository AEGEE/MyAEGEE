const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const votingLifecycle = require('../../lib/voting_lifecycle');
const { sequelize } = require('../../lib/sequelize');
const { VotesPerAntenna, Voting, VotingBodyAllotment, VotingDelegateVote } = require('../../models');

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const fromNow = (ms) => new Date(Date.now() + ms);

// A voting opens by itself at opens_at and closes by itself at closes_at:
// a job per voting does it on time, and every request that reads a voting does it
// when the job was missed. There is no manual opening or closing.
describe('Votings lifecycle', () => {
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
        cron.clearAll();
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

    const statusInDatabase = async (voting) => (await Voting.findByPk(voting.id)).status;

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

            const voting = await generator.createVoting({ opens_at: fromNow(-1000), closes_at: fromNow(3600 * 1000) }, event);
            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('open');
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

        test('should stay scheduled and take no snapshot before opens_at', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await generator.createVoting({ opens_at: fromNow(60 * 1000) }, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.body.data.status).toEqual('scheduled');
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(0);
        });

        test('should open at opens_at by the job, without any request', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await generator.createVoting({ opens_at: fromNow(700), closes_at: fromNow(3600 * 1000) }, event);

            expect(await statusInDatabase(voting)).toEqual('scheduled');
            await sleep(1500);

            expect(await statusInDatabase(voting)).toEqual('open');
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(1);
        });

        test('should open on the first request when the job was missed', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ opens_at: fromNow(300), closes_at: fromNow(3600 * 1000) }, event);
            cron.clearAll(); // the job is missed, for example because the server was busy or restarted
            await sleep(500);
            expect(await statusInDatabase(voting)).toEqual('scheduled');

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.body.data.status).toEqual('open');
        });

        test('should open and close at once when the whole time window was missed', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 2 });
            await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await generator.createVoting({ opens_at: fromNow(-2 * 3600 * 1000), closes_at: fromNow(-3600 * 1000), majority: 'simple' }, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.body.data.status).toEqual('closed');
            expect(res.body.data.result).toEqual('rejected');
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(1);
        });

        test('should still open on time when the job fires a little early', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ opens_at: fromNow(300), closes_at: fromNow(3600 * 1000) }, event);
            cron.clearAll();

            await votingLifecycle.runScheduledSync(voting.id); // fires 300 ms before opens_at

            expect(await statusInDatabase(voting)).toEqual('open');
        });

        test('should do nothing when the job finds no voting', async () => {
            await expect(votingLifecycle.runScheduledSync(999999)).resolves.toEqual(undefined);
        });

        test('should open the votings that are due when the server starts', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const due = await generator.createVoting({ opens_at: fromNow(300), closes_at: fromNow(3600 * 1000) }, event);
            const later = await generator.createVoting({ opens_at: fromNow(3600 * 1000) }, event);
            cron.clearAll(); // the server was down
            await sleep(500);

            await cron.registerAllDeadlines();

            expect(await statusInDatabase(due)).toEqual('open');
            expect(await statusInDatabase(later)).toEqual('scheduled');
            const jobs = Object.values(cron.jobs).map((job) => [job.key, job.params.id]).sort();
            expect(jobs).toEqual([['CLOSE_VOTING', due.id], ['CLOSE_VOTING', later.id], ['OPEN_VOTING', later.id]].sort());
        });

        test('should take one snapshot when several requests open the voting at the same moment', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 2 });
            await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await generator.createVoting({ opens_at: fromNow(-1000), closes_at: fromNow(3600 * 1000) }, event);

            const responses = await Promise.all(Array.from(
                { length: 5 },
                () => call('GET', '/events/' + event.id + '/votings/' + voting.id)
            ));

            expect(responses.map((res) => res.body.data.status)).toEqual(Array(5).fill('open'));
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(1);
            expect(await VotingBodyAllotment.count({ where: { voting_id: voting.id } })).toEqual(1);
        });

        test('should keep the snapshot when the votes or the delegates change later', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const votes = await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 4 });
            const first = await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event);
            await generator.createPresentDelegate({ user_id: 11, body_id: 34 }, event);

            const voting = await generator.createOpenVoting({}, event);

            await votes.update({ votes: 10 });
            await first.update({ departed: true });
            await generator.createPresentDelegate({ user_id: 12, body_id: 34 }, event);

            const body = await VotingBodyAllotment.findOne({ where: { voting_id: voting.id, body_id: 34 } });
            expect(body.votes_total).toEqual(4);
            expect(body.min_votes).toEqual(2);
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(2);

            // The next voting takes a new snapshot.
            const nextVoting = await generator.createOpenVoting({}, event);
            const nextBody = await VotingBodyAllotment.findOne({ where: { voting_id: nextVoting.id, body_id: 34 } });
            expect(nextBody.votes_total).toEqual(10);
            expect(nextBody.min_votes).toEqual(5);
            expect(await VotingDelegateVote.count({ where: { voting_id: nextVoting.id } })).toEqual(2);
        });

        test('should open a voting without any present delegates', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const voting = await generator.createOpenVoting({}, event);

            expect(voting.status).toEqual('open');
            expect(await VotingBodyAllotment.count({ where: { voting_id: voting.id } })).toEqual(0);

            const progress = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/progress');
            expect(progress.body.data).toMatchObject({ votes_total: 0, votes_cast: 0, votes_cast_percentage: 0 });
        });
    });

    describe('closing', () => {
        // Two bodies: body 34 has 5 votes and 2 delegates, body 9 has 1 vote and 1 delegate.
        const openVotingWithDelegates = async (options = {}) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 9, votes: 1 });
            const delegates = [
                await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 11, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 12, body_id: 9 }, event)
            ];
            const voting = await generator.createOpenVoting(options, event);
            return { event, voting, delegates };
        };

        test.each([
            ['simple', 'accepted'],
            ['absolute', 'rejected'],
            ['two_thirds', 'rejected']
        ])('should count the votes with a %s majority and store the result', async (majority, expected) => {
            const { event, voting, delegates } = await openVotingWithDelegates({ majority });
            await castVotes(voting.id, delegates[0], { in_favour: 2, against: 1 });
            await castVotes(voting.id, delegates[1], { abstention: 2 });
            // in favour 2, against 1, abstention 2; the delegate of body 9 does not vote.
            await generator.endVotingTime(voting);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('closed');
            expect(res.body.data.result).toEqual(expected);
            expect(res.body.data.closed_at).not.toEqual(null);
        });

        test('should accept with a two thirds majority', async () => {
            const { voting, delegates } = await openVotingWithDelegates({ majority: 'two_thirds' });
            await castVotes(voting.id, delegates[0], { in_favour: 3 });
            await castVotes(voting.id, delegates[1], { against: 1 });

            const closed = await generator.closeVoting(voting);

            expect(closed.result).toEqual('accepted');
        });

        test('should close at closes_at by the job, without any request', async () => {
            const { voting, delegates } = await openVotingWithDelegates({ majority: 'simple', closes_at: fromNow(700) });
            await castVotes(voting.id, delegates[0], { in_favour: 1 });

            await sleep(1500);

            const stored = await Voting.findByPk(voting.id);
            expect(stored.status).toEqual('closed');
            expect(stored.result).toEqual('accepted');
        });

        test('should wait for a vote that is being stored before it counts', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates({ majority: 'simple', closes_at: fromNow(1000) });
            cron.clearAll(); // the closing comes from the request below

            // A vote that is in the middle of being stored: its transaction is not committed yet.
            const transaction = await sequelize.transaction();
            await VotingDelegateVote.update({ in_favour: 1 }, {
                where: { voting_id: voting.id, application_id: delegates[2].id },
                transaction
            });
            await sleep(1200); // closes_at passed

            let answered = false;
            const reading = call('GET', '/events/' + event.id + '/votings/' + voting.id).then((res) => {
                answered = true;
                return res;
            });

            await sleep(500);
            expect(answered).toEqual(false);

            await transaction.commit();
            const res = await reading;

            expect(res.body.data.status).toEqual('closed');
            expect(res.body.data.result).toEqual('accepted'); // the vote in favour was counted
        });
    });

    describe('progress', () => {
        const openVotingWithDelegates = async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 9, votes: 1 });
            const delegates = [
                await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 11, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 12, body_id: 9 }, event)
            ];
            const voting = await generator.createOpenVoting({ majority: 'simple' }, event);
            return { event, voting, delegates };
        };

        test('should show only who voted and how many votes are cast while the voting is open', async () => {
            const { event, voting, delegates } = await openVotingWithDelegates();
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
            for (const field of ['in_favour', 'against', 'abstention', 'result']) {
                expect(res.body.data).not.toHaveProperty(field);
                expect(res.body.data.bodies[1]).not.toHaveProperty(field);
            }
        });

        test('should not show the progress without the permission', async () => {
            const { event, voting } = await openVotingWithDelegates();
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/progress');

            expect(res.statusCode).toEqual(403);
        });

        test('should not show the progress of a voting that did not open yet', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/progress');

            expect(res.statusCode).toEqual(409);
        });
    });

    describe('result and publishing', () => {
        // Body 34 votes 2 in favour and 1 against, body 9 does not vote, body 50 abstains with 1 vote.
        const closedVoting = async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 9, votes: 1 });
            await VotesPerAntenna.create({ event_id: event.id, body_id: 50, votes: 2 });
            const delegates = [
                await generator.createPresentDelegate({ user_id: 10, body_id: 34 }, event),
                await generator.createPresentDelegate({ user_id: 12, body_id: 9 }, event),
                await generator.createPresentDelegate({ user_id: 13, body_id: 50 }, event)
            ];
            const voting = await generator.createOpenVoting({ majority: 'simple' }, event);
            await castVotes(voting.id, delegates[0], { in_favour: 2, against: 1 });
            await castVotes(voting.id, delegates[2], { abstention: 1 });
            return { event, voting: await generator.closeVoting(voting) };
        };

        const expectedResult = {
            majority: 'simple',
            result: 'accepted',
            in_favour: 2,
            against: 1,
            abstention: 1,
            in_favour_percentage: 50,
            against_percentage: 25,
            abstention_percentage: 25,
            votes_total: 8,
            votes_cast: 4,
            votes_cast_percentage: 50,
            bodies_available: 3,
            bodies_present: 2,
            bodies_present_percentage: 66.67,
            // As in OMS: one row per body that voted.
            bodies: [
                { body_id: 34, votes_total: 5, votes_cast: 3, in_favour: 2, against: 1, abstention: 0 },
                { body_id: 50, votes_total: 2, votes_cast: 1, in_favour: 0, against: 0, abstention: 1 }
            ]
        };

        test('should show the result to the JC once the voting is closed, before it is published', async () => {
            const { event, voting } = await closedVoting();

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ ...expectedResult, published: false });
        });

        test('should not show the result to others before it is published', async () => {
            const { event, voting } = await closedVoting();
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain('not published');
            expect(res.body).not.toHaveProperty('data');
        });

        test('should show the full result, also per body, to every logged-in user once the JC published it', async () => {
            const { event, voting } = await closedVoting();

            const publishRes = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/publish');
            expect(publishRes.statusCode).toEqual(200);
            expect(publishRes.body.data.published).toEqual(true);
            expect(publishRes.body.data.published_by).toEqual(1);
            expect(publishRes.body.data.published_at).not.toEqual(null);

            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ ...expectedResult, published: true });
        });

        test('should not show the result to users who are not logged in', async () => {
            const { event, voting } = await closedVoting();
            await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/publish');
            mock.mockAll({ core: { unauthorized: true } });

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(401);
        });

        test('should keep the first publication when the JC publishes again', async () => {
            const { event, voting } = await closedVoting();
            const first = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/publish');
            const second = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/publish');

            expect(second.statusCode).toEqual(200);
            expect(second.body.data.published_at).toEqual(first.body.data.published_at);
        });

        test('should not publish a voting that is still open', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({}, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/publish');

            expect(res.statusCode).toEqual(409);
            expect((await Voting.findByPk(voting.id)).published).toEqual(false);
        });

        test('should not publish without the permission', async () => {
            const { event, voting } = await closedVoting();
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id + '/publish');

            expect(res.statusCode).toEqual(403);
        });

        test('should not show a result while the voting is open', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({}, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(409);
            expect(res.body).not.toHaveProperty('data');
        });

        test('should not show a result for a voting that did not open yet', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id + '/result');

            expect(res.statusCode).toEqual(409);
        });
    });
});
