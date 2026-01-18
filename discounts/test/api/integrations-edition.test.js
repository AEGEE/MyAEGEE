const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

describe('Integrations edition', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should fail if user does not have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const integration = await generator.createIntegration({ code: 'first' });

        const res = await request({
            uri: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { code: 'test' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            uri: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { code: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.code).toEqual('test');
    });

    test('should fail on validation errors', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            uri: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { code: null }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('code');
    });

    test('should return 404 if the integration is not found', async () => {
        const res = await request({
            uri: '/integrations/random',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { code: 'test' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should find integration by code', async () => {
        await generator.createIntegration({ code: 'first' });
        const res = await request({
            uri: '/integrations/first',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { code: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.code).toEqual('test');
    });
});
