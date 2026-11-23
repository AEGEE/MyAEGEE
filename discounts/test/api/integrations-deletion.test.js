const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Integration, Code } = require('../../models');

describe('Integrations deletion', () => {
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
            path: '/integrations/' + integration.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const integrationFromDB = await Integration.findByPk(integration.id);
        expect(integrationFromDB).toBeFalsy();
    });

    test('should return 404 if the integration is not found', async () => {
        const res = await request({
            path: '/integrations/random',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should find integration by code', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/first',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const integrationFromDB = await Integration.findByPk(integration.id);
        expect(integrationFromDB).toBeFalsy();
    });
    test.each([
        ['free', {}],
        ['claimed', { claimed_by: 1 }]
    ])('should answer 409 and keep the integration and its codes if it has %s codes', async (_, codeOptions) => {
        const integration = await generator.createIntegration({ code: 'first' });
        const code = await generator.createCode(codeOptions, integration);

        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(409);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('The integration has codes, so it cannot be deleted. Codes cannot be deleted either, so the integration stays.');

        expect(await Integration.findByPk(integration.id)).toBeTruthy();
        expect(await Code.findByPk(code.id)).toBeTruthy();
    });
});
