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

    test('should return data correctly on /metrics', async () => {
        const event = await generator.createEvent({
            name: 'Agora',
            type: 'training',
            status: 'published',
            deleted: false
        });
        await generator.createApplication(event, { user_id: 1, status: 'accepted', body_name: 'AEGEE-Accepted' });
        await generator.createApplication(event, { user_id: 2, status: 'accepted', body_name: 'AEGEE-Accepted' });
        await generator.createApplication(event, { user_id: 3, status: 'pending', body_name: 'AEGEE-Test' });
        await generator.createApplication(event, { user_id: 4, body_name: 'AEGEE-Test', status: 'pending' });
        await generator.createApplication(event, { user_id: 5, body_name: 'AEGEE-Test', status: 'pending' });

        const res = await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('events_events_total');
        expect(res.body).toMatch(/events_events_total\{[^}]*type="training"[^}]*status="published"[^}]*deleted="false"[^}]*\} 1/);
        expect(res.body).toMatch(/events_applications_total\{[^}]*body_name="AEGEE-Accepted"[^}]*status="accepted"[^}]*event_name="Agora"[^}]*\} 2/);
        expect(res.body).toMatch(/events_applications_total\{[^}]*body_name="AEGEE-Test"[^}]*status="pending"[^}]*event_name="Agora"[^}]*\} 3/);
    });

    test('should return data correctly on /metrics/requests', async () => {
        await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        await request({
            uri: '/metrics/requests',
            method: 'GET',
            json: false
        });

        const res = await request({
            uri: '/metrics/requests',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('events_requests_total');
        expect(res.body).toContain('endpoint="/metrics"');
        expect(res.body).toContain('path="/metrics"');
        expect(res.body).toContain('endpoint="/metrics/requests"');
        expect(res.body).toContain('path="/metrics/requests"');
        expect(res.body).toContain('method="GET"');
    });
});
