const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');
const regularUser = require('../assets/core-valid.json').data;
const { sequelize } = require('../../lib/sequelize');
const { Application } = require('../../models');

const BUSY = { success: false, message: 'The server is busy, please try again.' };

// Requests that change the same rows at the same time run one after the other: the
// statutory ID of the applications to an event. A request waits for such a lock at most
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
});
