const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock-core-registry');

describe('Metrics requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should count events and applications on /metrics', async () => {
        const event = await generator.createEvent({ type: 'nwm', status: 'published', name: 'Metrics event' });
        await generator.createApplication(event, { user_id: 1, status: 'accepted', body_name: 'AEGEE-Metrics' });
        await generator.createApplication(event, { user_id: 2, status: 'accepted', body_name: 'AEGEE-Metrics' });

        const res = await request({ path: '/metrics', headers: { 'X-Auth-Token': 'foobar' } });

        // One line per label combination: `name{label="value",...} count`.
        const line = (name, labels) => res.body.split('\n').find((l) => l.startsWith(name + '{')
            && Object.entries(labels).every(([key, value]) => l.includes(`${key}="${value}"`)));

        expect(res.statusCode).toEqual(200);
        expect(line('events_events_total', { type: 'nwm', status: 'published', deleted: 'false' })).toMatch(/ 1$/);
        expect(line('events_applications_total', { event_name: 'Metrics event', status: 'accepted', body_name: 'AEGEE-Metrics' })).toMatch(/ 2$/);
    });

    test('should return data correctly on /metrics', async () => {
        const event = await generator.createEvent({});
        await generator.createApplication(event, { user_id: 1, status: 'accepted' });
        await generator.createApplication(event, { user_id: 2, status: 'accepted' });
        await generator.createApplication(event, { user_id: 3, status: 'pending' });
        await generator.createApplication(event, { user_id: 4, body_name: 1, status: 'pending' });
        await generator.createApplication(event, { user_id: 5, body_name: 1, status: 'pending' });

        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
    });

    test('should return data correctly on /metrics/requests', async () => {
        const res = await request({
            path: '/metrics/requests',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
    });
});
