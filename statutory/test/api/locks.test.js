const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');
const regularUser = require('../assets/core-valid.json').data;
const { sequelize } = require('../../lib/sequelize');
const { Application, VotesPerAntenna, VotesPerDelegate } = require('../../models');

const BUSY = { success: false, message: 'The server is busy, please try again.' };

// Requests that change the same rows at the same time run one after the other: the
// statutory ID of the applications to an event, the votes of the delegates of a body. A request waits for such a lock at most
// postgres.lock_timeout, then answers 503 and changes nothing.
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
});
