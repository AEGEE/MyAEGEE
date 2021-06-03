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
        const event = await generator.createEvent({});
        await generator.createApplication({ user_id: 1, status: 'accepted' }, event);
        await generator.createApplication({ user_id: 2, status: 'accepted' }, event);
        await generator.createApplication({ user_id: 3, status: 'pending' }, event);
        await generator.createApplication({ user_id: 4, body_name: 1, status: 'pending' }, event);
        await generator.createApplication({ user_id: 5, body_name: 1, status: 'pending' }, event);

        const res = await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
    });

    test('should return data correctly on /metrics/requests', async () => {
        const res = await request({
            uri: '/metrics/requests',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
    });
});
