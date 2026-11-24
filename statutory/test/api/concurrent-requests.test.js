const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// The database pool holds 5 connections. Requests that run at the same time each finish
// with the connection of their own transaction, so more of them than the pool holds still
// answer within seconds.
describe('Requests at the same time', () => {
    const COUNT = 6;

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

    const createOpenEvents = () => Promise.all(Array.from({ length: COUNT }, () => generator.createEvent({
        type: 'agora',
        application_period_starts: moment().subtract(1, 'week').toDate(),
        application_period_ends: moment().add(1, 'week').toDate(),
        applications: []
    })));

    const timed = async (requests) => {
        const started = Date.now();
        const responses = await Promise.all(requests);
        return { responses, elapsed: Date.now() - started };
    };

    test(`${COUNT} applications to ${COUNT} events answer within seconds`, async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const events = await createOpenEvents();

        const { responses, elapsed } = await timed(events.map((event) => request({
            path: '/events/' + event.id + '/applications',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({ body_id: regularUser.bodies[0].id }, event)
        })));

        expect(responses.map((res) => res.statusCode)).toEqual(Array(COUNT).fill(200));
        expect(elapsed).toBeLessThan(5000);
    }, 20000);

    test(`${COUNT} edits of applications to ${COUNT} events answer within seconds`, async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const events = await createOpenEvents();
        await Promise.all(events.map((event) => generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id
        }, event)));

        const { responses, elapsed } = await timed(events.map((event) => request({
            path: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { allergies: 'Edited at the same time' }
        })));

        expect(responses.map((res) => res.statusCode)).toEqual(Array(COUNT).fill(200));
        expect(elapsed).toBeLessThan(5000);
    }, 20000);

    test(`${COUNT} board comments on applications to ${COUNT} events answer within seconds`, async () => {
        mock.mockAll({ mainPermissions: { permissions: ['global:approve_members:agora'] } });
        const events = await createOpenEvents();
        const applications = await Promise.all(events.map((event) => generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event)));

        const { responses, elapsed } = await timed(applications.map((application) => request({
            path: '/events/' + application.event_id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { board_comment: 'Set at the same time', participant_type: 'delegate', participant_order: 1 }
        })));

        expect(responses.map((res) => res.statusCode)).toEqual(Array(COUNT).fill(200));
        expect(elapsed).toBeLessThan(5000);
    }, 20000);
});
