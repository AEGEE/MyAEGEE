const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');
const regularUser = require('../assets/core-valid.json').data;
const { sequelize } = require('../../lib/sequelize');
const { Application, Attendance, MembersList, VotesPerAntenna, VotesPerDelegate } = require('../../models');

const BUSY = { success: false, message: 'The server is busy, please try again.' };

// Requests that change the same rows at the same time run one after the other: the
// statutory ID of the applications to an event and the votes of a body and its delegates.
// A request waits for such a lock at most postgres.lock_timeout, then answers 503 and
// changes nothing. A member has at most one open attendance at a plenary.
describe('Locks', () => {
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
        await generator.clearAll();
        mock.cleanAll();
    });

    // Holds a lock in a transaction of its own while `whileHeld` runs.
    const holdingLock = (lockQuery, replacements, whileHeld) => sequelize.transaction(async (t) => {
        await sequelize.query(lockQuery, { replacements, transaction: t });
        return whileHeld();
    });

    describe('the statutory ID of the applications to an event', () => {
        test('an application that waits too long for the lock answers 503 and is not saved', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate(),
                applications: []
            });

            const started = Date.now();
            const res = await holdingLock(
                'SELECT pg_advisory_xact_lock(hashtext(\'applications.statutory_id\'), :eventId)',
                { eventId: event.id },
                () => request({
                    path: '/events/' + event.id + '/applications',
                    method: 'POST',
                    headers: { 'X-Auth-Token': 'blablabla' },
                    body: generator.generateApplication({ body_id: regularUser.bodies[0].id }, event)
                })
            );

            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual(BUSY);
            expect(Date.now() - started).toBeGreaterThanOrEqual(config.postgres.lock_timeout - 50);
            expect(await Application.count()).toEqual(0);
        }, 20000);
    });

    describe('the votes of the delegates of a body', () => {
        const BODY_ID = 4242;
        const VOTES = 10;

        const createDelegates = async (event, count) => {
            await VotesPerAntenna.create({ event_id: event.id, body_id: BODY_ID, votes: VOTES });

            // One after the other: the statutory ID lock only holds within a transaction.
            const delegates = [];
            for (let index = 0; index < count; index++) {
                delegates.push(await generator.createApplication({
                    body_id: BODY_ID,
                    participant_type: 'delegate',
                    participant_order: index + 1,
                    status: 'accepted'
                }, event));
            }

            return delegates;
        };

        const confirm = (event, application) => request({
            path: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: true }
        });

        test('confirming three delegates at the same time shares the votes of the body once', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            // The rows came out doubled in most rounds without the lock.
            for (let round = 0; round < 5; round++) {
                await VotesPerDelegate.destroy({ where: {} });
                await VotesPerAntenna.destroy({ where: {} });
                await Application.destroy({ where: {} });
                const delegates = await createDelegates(event, 3);

                const responses = await Promise.all(delegates.map((delegate) => confirm(event, delegate)));
                expect(responses.map((res) => res.statusCode)).toEqual([200, 200, 200]);

                const votes = await VotesPerDelegate.findAll({ where: { event_id: event.id, body_id: BODY_ID, type: 'off-event' } });
                expect(votes.map((vote) => vote.application_id).sort()).toEqual(delegates.map((delegate) => delegate.id).sort());
                expect(votes.reduce((sum, vote) => sum + vote.votes, 0)).toEqual(VOTES);
            }
        });

        test('a confirmation that waits too long for the votes of the body answers 503 and changes nothing', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const [delegate] = await createDelegates(event, 1);

            const res = await holdingLock(
                'SELECT * FROM votes_per_antenna WHERE event_id = :eventId AND body_id = :bodyId FOR UPDATE',
                { eventId: event.id, bodyId: BODY_ID },
                () => confirm(event, delegate)
            );

            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual(BUSY);

            const unchanged = await Application.findByPk(delegate.id);
            expect(unchanged.confirmed).toEqual(false);
            expect(await VotesPerDelegate.count()).toEqual(0);
        }, 20000);
    });

    describe('the votes of a body after its members list', () => {
        test.each([
            ['a first members list', false],
            ['an edit of the members list', true]
        ])('%s that waits too long for the votes of the body answers 503 and stores nothing', async (description, existing) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const bodyId = regularUser.bodies[0].id;
            await VotesPerAntenna.create({ event_id: event.id, body_id: bodyId, votes: 1 });
            const before = existing
                ? await generator.createMembersList({ body_id: bodyId, members: [generator.generateMembersListMember()] }, event)
                : null;

            const res = await holdingLock(
                'SELECT * FROM votes_per_antenna WHERE event_id = :eventId AND body_id = :bodyId FOR UPDATE',
                { eventId: event.id, bodyId },
                () => request({
                    path: '/events/' + event.id + '/memberslists/' + bodyId,
                    method: 'POST',
                    headers: { 'X-Auth-Token': 'blablabla' },
                    body: generator.generateMembersList({ members: Array.from({ length: 30 }, () => generator.generateMembersListMember()) })
                })
            );

            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual(BUSY);

            const stored = await MembersList.findAll();
            expect(stored.map((list) => list.members.length)).toEqual(existing ? [before.members.length] : []);
            expect((await VotesPerAntenna.findOne()).votes).toEqual(1);
        }, 20000);
    });

    describe('the attendance of a member at a plenary', () => {
        test('marking a delegate twice at the same time leaves one attendance', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(1, 'hour').toDate(),
                ends: moment().add(1, 'hour').toDate()
            }, event);

            // Two open attendances came out in about a third of the rounds without the guard.
            for (let round = 0; round < 10; round++) {
                await Attendance.destroy({ where: {} });
                await Application.destroy({ where: {} });
                const application = await generator.createApplication({
                    participant_type: 'delegate',
                    participant_order: 1,
                    status: 'accepted'
                }, event);

                const responses = await Promise.all([1, 2].map(() => request({
                    path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
                    method: 'POST',
                    headers: { 'X-Auth-Token': 'blablabla' },
                    body: { application_id: application.id }
                })));

                // One attendance: open when both marks met, closed when one came after the
                // other. A mark that would close it in the millisecond it was opened answers 422.
                const attendances = await Attendance.findAll({ where: { plenary_id: plenary.id, application_id: application.id } });
                expect(attendances.length).toEqual(1);

                const answered = responses.filter((res) => res.statusCode === 200);
                expect(answered.length).toBeGreaterThanOrEqual(1);
                expect(responses.every((res) => [200, 422].includes(res.statusCode))).toEqual(true);
                expect(answered.map((res) => res.body.data.id)).toEqual(answered.map(() => attendances[0].id));
            }
        });
    });
});
