const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Integration } = require('../../models');

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
            path: '/integrations/' + integration.id,
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
            path: '/integrations/' + integration.id,
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
            path: '/integrations/' + integration.id,
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
            path: '/integrations/random',
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
            path: '/integrations/first',
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

    test('should not let the body change the id or the timestamps', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                id: 999,
                name: 'New name',
                created_at: '2000-01-01T00:00:00.000Z'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(integration.id);
        expect(res.body.data.name).toEqual('New name');

        const integrationFromDb = await Integration.findByPk(integration.id);
        expect(integrationFromDb.name).toEqual('New name');
        expect(integrationFromDb.created_at.toISOString()).toEqual(integration.created_at.toISOString());
        expect(await Integration.findByPk(999)).toBeNull();
    });

    // name, code and quota_period are varchar(255) columns.
    test.each([
        ['name', 'Integration name should be at most 255 characters long.'],
        ['code', 'Integration code should be at most 255 characters long.'],
        ['quota_period', 'Integration quota period should be one of these: "day", "month", "year".']
    ])('should fail with 422 and keep the integration if the %s has 300 characters', async (field, message) => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { [field]: 'a'.repeat(300) }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors[field]).toEqual([message]);

        const integrationFromDb = await Integration.findByPk(integration.id);
        expect(integrationFromDb[field]).toEqual(integration[field]);
    });

    test('should store the name and the code without their surrounding spaces', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: '  Partner\r', code: ' partner\t' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual('Partner');
        expect(res.body.data.code).toEqual('partner');

        const integrationFromDb = await Integration.findByPk(integration.id);
        expect(integrationFromDb.name).toEqual('Partner');
        expect(integrationFromDb.code).toEqual('partner');
    });

    test('should fail with 422 and keep the integration if the code is taken already once its spaces are removed', async () => {
        await generator.createIntegration({ code: 'taken' });
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { code: 'taken ' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors.code).toEqual(['Integration code is already taken.']);

        const integrationFromDb = await Integration.findByPk(integration.id);
        expect(integrationFromDb.code).toEqual('first');
    });

    test('should return the integration as stored, with a numeric quota amount sent as a string', async () => {
        const integration = await generator.createIntegration({ code: 'first', quota_amount: 1 });
        const res = await request({
            path: '/integrations/' + integration.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { quota_amount: '7' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.quota_amount).toEqual(7);

        const integrationFromDb = await Integration.findByPk(integration.id);
        expect(res.body.data).toEqual(JSON.parse(JSON.stringify(integrationFromDb)));
    });
});
