const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Integration } = require('../../models');

describe('Integrations creation', () => {
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
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const integration = generator.generateIntegration();
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: integration
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual(integration.name);
        expect(res.body.data.code).toEqual(integration.code);
        expect(res.body.data.quota_period).toEqual(integration.quota_period);
        expect(res.body.data.quota_amount).toEqual(integration.quota_amount);

        const integrationFromDB = await Integration.findOne({ where: { id: res.body.data.id } });

        expect(integrationFromDB.name).toEqual(res.body.data.name);
        expect(integrationFromDB.code).toEqual(res.body.data.code);
        expect(integrationFromDB.quota_period).toEqual(res.body.data.quota_period);
        expect(integrationFromDB.quota_amount).toEqual(res.body.data.quota_amount);
    });

    test('should fail if code is not set', async () => {
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ code: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('code');
    });

    test('should fail if amount quota is not set', async () => {
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_amount: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('quota_amount');
    });

    test('should fail if amount quota is not a number', async () => {
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_amount: false })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('quota_amount');
    });

    test('should fail if amount quota is negative', async () => {
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_amount: -1 })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('quota_amount');
    });

    test('should fail if amount period is negative', async () => {
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_period: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('quota_period');
    });

    test('should fail if the code is taken already', async () => {
        await generator.createIntegration({ code: 'test' });
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ code: 'test' })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('code');
    });

    test('should fail if the quota period is invalid', async () => {
        const res = await request({
            uri: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_period: 'bullshit' })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('quota_period');
    });
});
