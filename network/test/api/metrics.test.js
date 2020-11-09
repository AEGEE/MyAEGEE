const { startServer, stopServer } = require('../../lib/server.js');
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
        await generator.createBody();

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
