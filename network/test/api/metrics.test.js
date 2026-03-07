const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

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
        await generator.createBoard();

        const res = await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('network_boards_total');
        expect(res.body).toContain('network_boards_total 1');
    });

    test('should return data correctly on /metrics/requests', async () => {
        await request({
            uri: '/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
            json: false
        });

        const res = await request({
            uri: '/metrics/requests',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('network_requests_total');
        expect(res.body).toContain('endpoint="/boards"');
        expect(res.body).toContain('path="/boards"');
        expect(res.body).toContain('method="GET"');
    });
});
