const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock-core-registry');
const packageInfo = require('../../package.json');

describe('Metrics requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        // Other files count rows, so nothing is left behind.
        await generator.clearAll();
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
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
    });

    test('should name only published events and their positions on /metrics', async () => {
        const createEventWithData = async (name, status) => {
            const event = await generator.createEvent({ type: 'agora', name, status });
            await generator.createApplication({}, event);
            await generator.createMembersList({}, event);
            const position = await generator.createPosition({ name: name + ' position' }, event);
            await generator.createCandidate({ user_id: 1, status: 'pending' }, position);
        };

        await createEventWithData('Published event of the metrics', 'published');
        await createEventWithData('Draft event of the metrics', 'draft');

        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('Published event of the metrics');
        expect(res.body).toContain('Published event of the metrics position');
        expect(res.body).not.toContain('Draft event of the metrics');
    });

    test('should return data correctly on /metrics/requests', async () => {
        const res = await request({
            path: '/metrics/requests',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
    });

    test('should return the name and the version on /healthcheck without a token', async () => {
        const res = await request({
            path: '/healthcheck',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({
            success: true,
            data: {
                name: packageInfo.name,
                description: packageInfo.description,
                version: packageInfo.version
            }
        });
    });
});
