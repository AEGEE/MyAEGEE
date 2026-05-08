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
        await generator.createCourse();

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
