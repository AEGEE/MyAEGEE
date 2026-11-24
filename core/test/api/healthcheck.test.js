const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const packageInfo = require('../../package.json');

describe('Healthcheck', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should name the service and its version', async () => {
        const res = await request({
            path: '/healthcheck',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({
            success: true,
            data: {
                name: 'core',
                description: packageInfo.description,
                version: packageInfo.version
            }
        });
        expect(res.body.data.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('should answer the same with a token that does not exist', async () => {
        const res = await request({
            path: '/healthcheck',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual('core');
    });

    test('should not count as activity of a member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/healthcheck',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);

        await user.reload();
        expect(user.last_active).toBeNull();
    });

    test('should not be counted in the metrics of the requests', async () => {
        await request({ path: '/healthcheck', method: 'GET' });

        const res = await request({
            path: '/metrics/requests',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).not.toContain('healthcheck');
    });
});
