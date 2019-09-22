const { startServer, stopServer } = require('../../lib/server.js');
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
    });

    test('should return data correctly on /metrics', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createApplication({}, event);

        await generator.createMembersList({}, event);
        const position = await generator.createPosition({}, event);
        await generator.createCandidate({ user_id: 1, status: 'pending' }, position);
        await generator.createCandidate({ user_id: 2, status: 'approved' }, position);
        await generator.createCandidate({ user_id: 3, status: 'approved' }, position);

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
