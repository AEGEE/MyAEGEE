const { startServer, stopServer } = require('../../lib/server');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { sequelize } = require('../../lib/sequelize');
const { request } = require('../scripts/helpers');
const {
    operations,
    createFixtures,
    requestFor,
    pathFor,
    ALL_PERMISSIONS
} = require('../scripts/operations');
const { VotesPerAntenna } = require('../../models');

const BUSY = { success: false, message: 'The server is busy, please try again.' };

// Every operation that documents 503 waits for a lock: the statutory IDs of the event, or
// the votes of the applicant's body. Held by another transaction for longer than the lock
// timeout, each answers 503.
describe('Lock timeouts of every operation', () => {
    let fixtures;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { permissions: ALL_PERMISSIONS } });
        fixtures = await createFixtures();
        await VotesPerAntenna.create({ event_id: fixtures.event.id, body_id: fixtures.body.id, votes: 3 });
        // The other body of the caller can send participants, so that the applicant may move to it.
        await generator.createPaxLimit({ body_id: regularUser.bodies[1].id, event_type: 'agora' });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    // Holds both locks in a transaction of its own while `whileHeld` runs.
    const holdingLocks = () => (whileHeld) => sequelize.transaction(async (t) => {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(\'applications.statutory_id\'), :eventId)', {
            replacements: { eventId: fixtures.event.id },
            transaction: t
        });
        await sequelize.query('SELECT * FROM votes_per_antenna WHERE event_id = :eventId AND body_id = :bodyId FOR UPDATE', {
            replacements: { eventId: fixtures.event.id, bodyId: fixtures.body.id },
            transaction: t
        });
        return whileHeld();
    });

    // What makes the request wait, where its valid request does not.
    const special = {
        // A move to another body recalculates the votes of the old one.
        updateApplication: { body: { body_id: regularUser.bodies[1].id } }
    };

    const rows = operations
        .filter((operation) => operation.statuses.includes('503'))
        .map((operation) => [`${operation.method} ${operation.template}`, operation]);

    test('the operations that can answer 503', () => {
        expect(rows.map(([, operation]) => operation.operationId).sort()).toEqual([
            'setApplicationAttended',
            'setApplicationBoard',
            'setApplicationCancelled',
            'setApplicationConfirmed',
            'setApplicationDeparted',
            'setApplicationIncoming',
            'setApplicationIsOnMemberslist',
            'setApplicationRegistered',
            'setApplicationStatus',
            'setBoardviewApplications',
            'submitApplication',
            'updateApplication',
            'uploadMemberslist'
        ]);
    });

    test.each(rows)('%s answers 503 when it waits too long for a lock', async (_, operation) => {
        const res = await holdingLocks()(() => (special[operation.operationId]
            ? request({
                path: pathFor(operation, fixtures),
                method: operation.method,
                headers: { 'X-Auth-Token': 'blablabla' },
                ...special[operation.operationId]
            })
            : requestFor(operation, fixtures)));

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(BUSY);
    }, 20000);
});
