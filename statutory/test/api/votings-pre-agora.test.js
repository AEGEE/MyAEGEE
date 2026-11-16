const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { sequelize } = require('../../lib/sequelize');
const { VotesPerAntenna, Voting, VotingDelegateVote } = require('../../models');

// Pre-Agora Voting (Working Format of the Agora, Art. 20): online between days 14 and 9
// before the Agora, by the delegates of the coming Agora, with a quorum of 50% of the Antennae
// and a two-thirds majority. The result is published at once and is binding, unless the item
// goes to the Agora for a new voting (rejected, no quorum, an amendment, or a change of the Statutes).
describe('Votings: Pre-Agora Voting', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    // The Agora starts in 10 days, so the Pre-Agora window (days 14 to 9) runs from 4 days ago to tomorrow.
    beforeEach(async () => {
        mock.mockAll({ core: { userFromToken: true } });
        event = await generator.createAgoraStartingIn(10);
    });

    afterEach(async () => {
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    const call = (method, path, body, token = 'blablabla') => request({
        path,
        method,
        headers: { 'X-Auth-Token': token },
        body
    });

    const votingPath = (voting, suffix = '') => '/events/' + event.id + '/votings/' + voting.id + suffix;

    const vote = (voting, userId, counts) => call('PUT', votingPath(voting, '/my-vote'), counts, 'user-' + userId);

    const openPreAgoraVoting = (options = {}) => generator.createOpenVoting({ phase: 'pre_agora', ...options }, event);

    // Antennae 1, 2, 3 and 4 have 3 votes and one delegate each (users 11 to 14), not checked in yet.
    const setUpAntennae = async () => {
        for (const bodyId of [1, 2, 3, 4]) {
            await VotesPerAntenna.create({ event_id: event.id, body_id: bodyId, votes: 3 });
            await generator.createUpcomingDelegate({ user_id: 10 + bodyId, body_id: bodyId }, event);
        }
    };

    const closeAndRead = async (voting) => {
        await generator.endVotingTime(voting);
        const res = await call('GET', votingPath(voting));
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('closed');
        return res.body.data;
    };

    describe('electorate', () => {
        test('should take a snapshot of the delegates of the coming Agora, also when they are not checked in', async () => {
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
            const upcoming = [];
            for (const userId of [10, 11]) {
                upcoming.push(await generator.createUpcomingDelegate({ user_id: userId, body_id: 34 }, event));
            }
            // Check-in and departure are about the hall of the Agora, so they do not matter before it.
            const checkedIn = await generator.createPresentDelegate({ user_id: 12, body_id: 34 }, event);
            await generator.createUpcomingDelegate({ user_id: 20, body_id: 34, confirmed: false }, event);
            await generator.createUpcomingDelegate({ user_id: 21, body_id: 34, status: 'pending' }, event);
            await generator.createUpcomingDelegate({ user_id: 22, body_id: 34, participant_type: 'observer' }, event);
            const cancelled = await generator.createUpcomingDelegate({ user_id: 23, body_id: 34 }, event);
            await sequelize.query('UPDATE applications SET cancelled = true WHERE id = :id', { replacements: { id: cancelled.id } });

            const voting = await openPreAgoraVoting();

            const rows = await VotingDelegateVote.findAll({ where: { voting_id: voting.id }, order: [['user_id', 'ASC']] });
            expect(rows.map((row) => [row.user_id, row.application_id, row.max_votes])).toEqual([
                [10, upcoming[0].id, 2],
                [11, upcoming[1].id, 2],
                [12, checkedIn.id, 2]
            ]);
        });

        test('should let a delegate vote before the Agora, while a voting on the Agora still needs the check-in', async () => {
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 2 });
            await generator.createUpcomingDelegate({ user_id: 10, body_id: 34 }, event);
            const preAgora = await openPreAgoraVoting();
            const onAgora = await generator.createOpenVoting({ phase: 'agora' }, event);

            const voted = await vote(preAgora, 10, { in_favour: 2 });
            expect(voted.statusCode).toEqual(200);
            expect(voted.body.data.voting.phase).toEqual('pre_agora');
            expect(voted.body.data.in_favour).toEqual(2);

            const refused = await vote(onAgora, 10, { in_favour: 2 });
            expect(refused.statusCode).toEqual(403);
        });

        test('should refuse a delegate whose application was cancelled after the voting opened', async () => {
            await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 2 });
            const delegate = await generator.createUpcomingDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await openPreAgoraVoting();
            await sequelize.query('UPDATE applications SET cancelled = true WHERE id = :id', { replacements: { id: delegate.id } });

            const res = await vote(voting, 10, { in_favour: 1 });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('not a delegate of this Agora any more');
        });

        test('should tell a user without votes that only the delegates of the coming Agora vote', async () => {
            const voting = await openPreAgoraVoting();

            const res = await call('GET', votingPath(voting, '/my-vote'), undefined, 'user-99');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('not a delegate of this Agora when it opened');
        });
    });

    describe('quorum', () => {
        test('should store the number of Antennae of the network when it opens, by the service login', async () => {
            mock.mockAll({ core: { userFromToken: true }, bodies: { antennae: 7 } });

            const voting = await openPreAgoraVoting();

            const stored = await Voting.findByPk(voting.id);
            expect(stored.antennae_total).toEqual(7); // not the contact antenna and the committee
            expect(stored.quorum_required).toEqual(4);
            expect(stored.antennae_voted).toEqual(null);
            expect(stored.quorum_reached).toEqual(null);
        });

        test('should reach the quorum when half of the Antennae voted', async () => {
            mock.mockAll({ core: { userFromToken: true }, bodies: { antennae: 4 } });
            await setUpAntennae();
            const voting = await openPreAgoraVoting();
            expect((await vote(voting, 11, { in_favour: 3 })).statusCode).toEqual(200);
            expect((await vote(voting, 12, { abstention: 1 })).statusCode).toEqual(200); // abstaining is voting

            const closed = await closeAndRead(voting);

            expect(closed.antennae_total).toEqual(4);
            expect(closed.quorum_required).toEqual(2);
            expect(closed.antennae_voted).toEqual(2);
            expect(closed.quorum_reached).toEqual(true);
            expect(closed.result).toEqual('accepted');
            expect(closed.outcome).toEqual('decided');
            expect(closed.outcome_reason).toEqual(null);
        });

        test('should send the item to the Agora when less than half of the Antennae voted', async () => {
            mock.mockAll({ core: { userFromToken: true }, bodies: { antennae: 4 } });
            await setUpAntennae();
            const voting = await openPreAgoraVoting();
            expect((await vote(voting, 11, { in_favour: 3 })).statusCode).toEqual(200);

            const closed = await closeAndRead(voting);

            expect(closed.antennae_voted).toEqual(1);
            expect(closed.quorum_reached).toEqual(false);
            expect(closed.result).toEqual('accepted');
            expect(closed.outcome).toEqual('to_agora');
            expect(closed.outcome_reason).toEqual('no_quorum');
        });

        test('should stay scheduled when core cannot be reached, and open on a later request', async () => {
            mock.mockAll({ core: { userFromToken: true }, bodies: { netError: true } });
            await generator.createUpcomingDelegate({ user_id: 10, body_id: 34 }, event);
            const voting = await generator.createVoting({ phase: 'pre_agora', opens_at: moment().subtract(1, 'second').toDate() }, event);

            const failed = await call('GET', votingPath(voting));
            expect(failed.statusCode).toEqual(500);
            expect((await Voting.findByPk(voting.id)).status).toEqual('scheduled');
            expect(await VotingDelegateVote.count({ where: { voting_id: voting.id } })).toEqual(0);

            mock.mockAll({ core: { userFromToken: true } });
            const opened = await call('GET', votingPath(voting));
            expect(opened.body.data.status).toEqual('open');
            expect(opened.body.data.antennae_total).toEqual(1);
        });

        test('should list the votings when core cannot be reached, with the Pre-Agora voting still scheduled', async () => {
            await generator.createUpcomingDelegate({ user_id: 10, body_id: 34 }, event);
            const preAgora = await generator.createVoting({ phase: 'pre_agora', opens_at: moment().add(300, 'ms').toDate() }, event);
            const onAgora = await generator.createOpenVoting({ phase: 'agora' }, event);
            cron.clearAll();
            await new Promise((resolve) => { setTimeout(resolve, 500); });
            mock.mockAll({ core: { userFromToken: true }, bodies: { netError: true } });

            const res = await call('GET', '/events/' + event.id + '/votings');

            expect(res.statusCode).toEqual(200);
            const statuses = Object.fromEntries(res.body.data.map((voting) => [voting.id, voting.status]));
            expect(statuses).toEqual({ [preAgora.id]: 'scheduled', [onAgora.id]: 'open' });
            expect((await Voting.findByPk(preAgora.id)).status).toEqual('scheduled');
        });

        test('should start the server when core cannot be reached, and open the Pre-Agora voting later', async () => {
            const preAgora = await generator.createVoting({ phase: 'pre_agora', opens_at: moment().add(300, 'ms').toDate() }, event);
            const onAgora = await generator.createVoting({ phase: 'agora', opens_at: moment().add(300, 'ms').toDate() }, event);
            cron.clearAll(); // the server was down
            await new Promise((resolve) => { setTimeout(resolve, 500); });
            mock.mockAll({ core: { userFromToken: true }, bodies: { netError: true } });

            await cron.registerAllDeadlines();

            expect((await Voting.findByPk(onAgora.id)).status).toEqual('open');
            expect((await Voting.findByPk(preAgora.id)).status).toEqual('scheduled');
            const jobs = Object.values(cron.jobs).filter((job) => job.params.id === preAgora.id).map((job) => job.key);
            expect(jobs).toEqual(['CLOSE_VOTING']);
        });
    });

    describe('majority', () => {
        test('should use a two-thirds majority when the JC gives none', async () => {
            const body = generator.generateVoting({ phase: 'pre_agora', opens_at: moment().add(1, 'hour').toDate() });
            delete body.majority;

            const res = await call('POST', '/events/' + event.id + '/votings', body);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.phase).toEqual('pre_agora');
            expect(res.body.data.majority).toEqual('two_thirds');
        });

        test.each(['simple', 'absolute'])('should refuse the majority %s', async (majority) => {
            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
                phase: 'pre_agora',
                majority,
                opens_at: moment().add(1, 'hour').toDate()
            }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('majority');
        });

        test('should use a two-thirds majority when the JC moves a voting to Pre-Agora', async () => {
            const voting = await generator.createVoting({ majority: 'simple', opens_at: moment().add(1, 'hour').toDate() }, event);

            const res = await call('PUT', votingPath(voting), { phase: 'pre_agora' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.majority).toEqual('two_thirds');
        });

        test('should refuse an unknown phase', async () => {
            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ phase: 'online' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('phase');
        });
    });

    describe('publishing and outcome', () => {
        test('should publish the result at closing, so every logged-in user sees how each Antenna voted', async () => {
            mock.mockAll({ core: { userFromToken: true }, bodies: { antennae: 4 } });
            await setUpAntennae();
            const voting = await openPreAgoraVoting();
            expect((await vote(voting, 11, { in_favour: 2, abstention: 1 })).statusCode).toEqual(200);
            expect((await vote(voting, 12, { in_favour: 3 })).statusCode).toEqual(200);

            const closed = await closeAndRead(voting);
            expect(closed.published).toEqual(true);
            expect(closed.published_by).toEqual(null);
            expect(closed.published_at).toEqual(closed.closed_at);

            mock.mockAll({ core: { userFromToken: true }, mainPermissions: { noPermissions: true } });
            const res = await call('GET', votingPath(voting, '/result'));
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.published).toEqual(true);
            expect(res.body.data.bodies).toEqual([
                { body_id: 1, votes_total: 3, votes_cast: 3, in_favour: 2, against: 0, abstention: 1 },
                { body_id: 2, votes_total: 3, votes_cast: 3, in_favour: 3, against: 0, abstention: 0 }
            ]);
            expect(res.body.data.outcome).toEqual('decided');
            expect(res.body.data.outcome_reason).toEqual(null);
            expect(res.body.data.quorum).toEqual({ antennae_total: 4, quorum_required: 2, antennae_voted: 2, quorum_reached: true });
        });

        test('should keep publishing by hand for a voting on the Agora', async () => {
            const voting = await generator.createOpenVoting({ phase: 'agora' }, event);

            const closed = await closeAndRead(voting);

            expect(closed.published).toEqual(false);
            expect(closed.outcome).toEqual(null);
            expect(closed.antennae_total).toEqual(null);
        });

        test.each([
            ['accepted', { in_favour: 3 }, {}, 'decided', null],
            ['rejected', { in_favour: 2, against: 1 }, {}, 'to_agora', 'rejected'],
            ['a change of the Statutes', { in_favour: 3 }, { concerns_statutes: true }, 'to_agora', 'statutes']
        ])('should give the outcome for an item that is %s', async (name, counts, fields, outcome, reason) => {
            await setUpAntennae();
            const voting = await openPreAgoraVoting(fields);
            expect((await vote(voting, 11, counts)).statusCode).toEqual(200);

            const closed = await closeAndRead(voting);

            expect(closed.outcome).toEqual(outcome);
            expect(closed.outcome_reason).toEqual(reason);
        });

        test('should only let a Pre-Agora voting concern the Statutes', async () => {
            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ phase: 'agora', concerns_statutes: true }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('concerns_statutes');
        });
    });

    describe('amendment', () => {
        const markAmendment = (voting, value) => call('PUT', votingPath(voting, '/amendment'), { amendment_submitted: value });

        test('should send a decided item to the Agora when the JC marks an amendment, and back when it unmarks it', async () => {
            await setUpAntennae();
            const voting = await openPreAgoraVoting();
            expect((await vote(voting, 11, { in_favour: 3 })).statusCode).toEqual(200);
            expect((await closeAndRead(voting)).outcome).toEqual('decided');

            const marked = await markAmendment(voting, true);
            expect(marked.statusCode).toEqual(200);
            expect(marked.body.data.amendment_submitted).toEqual(true);
            expect(marked.body.data.outcome).toEqual('to_agora');
            expect(marked.body.data.outcome_reason).toEqual('amendment');

            const unmarked = await markAmendment(voting, false);
            expect(unmarked.statusCode).toEqual(200);
            expect(unmarked.body.data.outcome).toEqual('decided');
            expect(unmarked.body.data.outcome_reason).toEqual(null);
        });

        test('should use an amendment that the JC marked before the voting closed', async () => {
            await setUpAntennae();
            const voting = await openPreAgoraVoting();
            expect((await markAmendment(voting, true)).statusCode).toEqual(200);
            expect((await vote(voting, 11, { in_favour: 3 })).statusCode).toEqual(200);

            const closed = await closeAndRead(voting);

            expect(closed.outcome).toEqual('to_agora');
            expect(closed.outcome_reason).toEqual('amendment');
        });

        test('should keep the first reason when an amendment comes on top of it', async () => {
            await setUpAntennae();
            const voting = await openPreAgoraVoting();
            expect((await vote(voting, 11, { in_favour: 1, against: 2 })).statusCode).toEqual(200);
            await closeAndRead(voting);

            const res = await markAmendment(voting, true);

            expect(res.body.data.outcome_reason).toEqual('rejected');
        });

        test('should refuse a user who cannot manage votings', async () => {
            const voting = await openPreAgoraVoting();
            mock.mockAll({ core: { userFromToken: true }, mainPermissions: { noPermissions: true } });

            const res = await markAmendment(voting, true);

            expect(res.statusCode).toEqual(403);
        });

        test('should refuse a voting on the Agora', async () => {
            const voting = await generator.createOpenVoting({ phase: 'agora' }, event);

            const res = await markAmendment(voting, true);

            expect(res.statusCode).toEqual(409);
        });

        test('should keep a voting with an amendment a Pre-Agora voting', async () => {
            const voting = await generator.createVoting({ phase: 'pre_agora', opens_at: moment().add(1, 'hour').toDate() }, event);
            expect((await markAmendment(voting, true)).statusCode).toEqual(200);

            const res = await call('PUT', votingPath(voting), { phase: 'agora', majority: 'simple' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('phase');
        });

        test.each([undefined, 'yes', 1])('should refuse the value %j', async (value) => {
            const voting = await openPreAgoraVoting();

            const res = await markAmendment(voting, value);

            expect(res.statusCode).toEqual(422);
        });
    });

    describe('voting on the Agora that follows a Pre-Agora voting', () => {
        const preAgoraVotingWithOutcome = async (counts) => {
            await setUpAntennae();
            const voting = await openPreAgoraVoting({ title: 'Change of the Statutes' });
            expect((await vote(voting, 11, counts)).statusCode).toEqual(200);
            await closeAndRead(voting);
            return voting;
        };

        const createFollowing = (followsVotingId) => call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
            phase: 'agora',
            follows_voting_id: followsVotingId
        }));

        test('should link the new voting to the Pre-Agora voting and its result', async () => {
            const preAgora = await preAgoraVotingWithOutcome({ in_favour: 1, against: 2 });

            const created = await createFollowing(preAgora.id);
            expect(created.statusCode).toEqual(200);
            expect(created.body.data.follows_voting_id).toEqual(preAgora.id);

            const fetched = await call('GET', '/events/' + event.id + '/votings/' + created.body.data.id);
            expect(fetched.statusCode).toEqual(200);
            expect(fetched.body.data.follows_voting_id).toEqual(preAgora.id);
            expect(fetched.body.data).not.toHaveProperty('follows');

            const res = await call('GET', '/events/' + event.id + '/votings/' + fetched.body.data.follows_voting_id);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: preAgora.id,
                title: 'Change of the Statutes',
                result: 'rejected',
                outcome: 'to_agora',
                outcome_reason: 'rejected'
            });
        });

        test('should refuse to follow a decided item, because its result is binding', async () => {
            const preAgora = await preAgoraVotingWithOutcome({ in_favour: 3 });

            const res = await createFollowing(preAgora.id);

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('follows_voting_id');
        });

        test('should refuse to follow a voting that is not a closed Pre-Agora voting of this Agora', async () => {
            const onAgora = await generator.createOpenVoting({ phase: 'agora' }, event);
            const open = await openPreAgoraVoting();
            const otherEvent = await generator.createAgoraStartingIn(10);
            const other = await generator.createOpenVoting({ phase: 'pre_agora' }, otherEvent);
            await generator.closeVoting(other);

            for (const id of [onAgora.id, open.id, other.id, 999999]) {
                const res = await createFollowing(id);
                expect(res.statusCode).toEqual(422);
                expect(res.body.errors).toHaveProperty('follows_voting_id');
            }
        });

        test('should refuse a Pre-Agora voting that follows another voting', async () => {
            const preAgora = await preAgoraVotingWithOutcome({ in_favour: 1, against: 2 });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
                phase: 'pre_agora',
                follows_voting_id: preAgora.id,
                opens_at: moment().add(1, 'hour').toDate()
            }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('follows_voting_id');
        });

        test('should refuse to unmark the amendment when a voting on the Agora follows the item', async () => {
            const preAgora = await preAgoraVotingWithOutcome({ in_favour: 3 });
            await call('PUT', votingPath(preAgora, '/amendment'), { amendment_submitted: true });
            expect((await createFollowing(preAgora.id)).statusCode).toEqual(200);

            const res = await call('PUT', votingPath(preAgora, '/amendment'), { amendment_submitted: false });

            expect(res.statusCode).toEqual(409);
            expect((await Voting.findByPk(preAgora.id)).outcome).toEqual('to_agora');
        });
    });

    describe('time window', () => {
        const starts = () => moment(event.starts);

        test('should accept a window from exactly day 14 to exactly day 9 before the Agora', async () => {
            event = await generator.createAgoraStartingIn(20);

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
                phase: 'pre_agora',
                opens_at: starts().subtract(14, 'days').toDate(),
                closes_at: starts().subtract(9, 'days').toDate()
            }));

            expect(res.statusCode).toEqual(200);
        });

        test.each([
            ['opens before day 14', { opens: 14 * 24 * 60 + 1, closes: 10 * 24 * 60 }, 'opens_at'],
            ['closes after day 9', { opens: 12 * 24 * 60, closes: 9 * 24 * 60 - 1 }, 'closes_at']
        ])('should refuse a voting that %s', async (name, minutesBefore, field) => {
            event = await generator.createAgoraStartingIn(20);

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
                phase: 'pre_agora',
                opens_at: starts().subtract(minutesBefore.opens, 'minutes').toDate(),
                closes_at: starts().subtract(minutesBefore.closes, 'minutes').toDate()
            }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
            expect(res.body.errors[field][0]).toContain('days 14 to 9');
        });

        test('should check the window again when the JC edits the voting', async () => {
            event = await generator.createAgoraStartingIn(20);
            const voting = await generator.createVoting({
                phase: 'pre_agora',
                opens_at: starts().subtract(12, 'days').toDate(),
                closes_at: starts().subtract(10, 'days').toDate()
            }, event);

            const res = await call('PUT', votingPath(voting), { closes_at: starts().subtract(5, 'days').toDate() });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('closes_at');
        });

        test('should not limit the window of a voting on the Agora', async () => {
            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
                phase: 'agora',
                opens_at: starts().add(1, 'day').toDate()
            }));

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('overview of the round', () => {
        test('should list only the votings of the phase that is asked for, with their outcome and quorum', async () => {
            await setUpAntennae();
            const preAgora = await openPreAgoraVoting({ title: 'Activity Plan' });
            expect((await vote(preAgora, 11, { in_favour: 3 })).statusCode).toEqual(200);
            await closeAndRead(preAgora);
            const onAgora = await generator.createOpenVoting({ phase: 'agora' }, event);

            const all = await call('GET', '/events/' + event.id + '/votings');
            expect(all.body.data.map((voting) => voting.id).sort()).toEqual([preAgora.id, onAgora.id].sort());

            const res = await request({
                path: '/events/' + event.id + '/votings',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' },
                query: { phase: 'pre_agora' }
            });
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0]).toMatchObject({
                id: preAgora.id,
                title: 'Activity Plan',
                phase: 'pre_agora',
                result: 'accepted',
                antennae_voted: 1,
                quorum_required: 1,
                quorum_reached: true,
                outcome: 'decided',
                outcome_reason: null
            });

            const agora = await request({
                path: '/events/' + event.id + '/votings',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' },
                query: { phase: 'agora' }
            });
            expect(agora.body.data.map((voting) => voting.id)).toEqual([onAgora.id]);
        });

        test('should refuse an unknown phase', async () => {
            const res = await request({
                path: '/events/' + event.id + '/votings',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' },
                query: { phase: 'online' }
            });

            expect(res.statusCode).toEqual(400);
        });
    });
});
