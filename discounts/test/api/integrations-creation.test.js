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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
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
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_period: 'bullshit' })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('quota_period');
    });

    test('should not let the body set the id or the timestamps', async () => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({
                id: 999,
                created_at: '2000-01-01T00:00:00.000Z',
                updated_at: '2000-01-01T00:00:00.000Z'
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).not.toEqual(999);
        expect(res.body.data.created_at).not.toEqual('2000-01-01T00:00:00.000Z');
        expect(res.body.data.updated_at).not.toEqual('2000-01-01T00:00:00.000Z');

        expect(await Integration.findByPk(999)).toBeNull();
    });

    // name and code are varchar(255) columns.
    test.each([
        ['name', 'Integration name should be at most 255 characters long.'],
        ['code', 'Integration code should be at most 255 characters long.']
    ])('should fail with 422 if the %s is longer than 255 characters', async (field, message) => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ [field]: 'a'.repeat(256) })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors[field]).toEqual([message]);
        expect(await Integration.count()).toEqual(0);
    });

    test('should accept a name and a code of 255 characters', async () => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ name: 'n'.repeat(255), code: 'c'.repeat(255) })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual('n'.repeat(255));
        expect(res.body.data.code).toEqual('c'.repeat(255));
    });

    // " foo" and "foo" must be one integration code.
    test('should store the name and the code without their surrounding spaces', async () => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ name: '  Partner\r', code: ' partner\t' })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual('Partner');
        expect(res.body.data.code).toEqual('partner');

        const integrationFromDb = await Integration.findByPk(res.body.data.id);
        expect(integrationFromDb.name).toEqual('Partner');
        expect(integrationFromDb.code).toEqual('partner');
    });

    test('should fail with 422 if the code is taken already once its spaces are removed', async () => {
        await generator.createIntegration({ code: 'test' });
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ code: ' test ' })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors.code).toEqual(['Integration code is already taken.']);
        expect(await Integration.count()).toEqual(1);
    });

    test.each([
        ['name', 'Integration name should be set.'],
        ['code', 'Integration code should be set.']
    ])('should fail with 422 if the %s is only spaces', async (field, message) => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ [field]: '   ' })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors[field]).toEqual([message]);
        expect(await Integration.count()).toEqual(0);
    });

    test('should check the length of the name and the code without their surrounding spaces', async () => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ name: ' ' + 'n'.repeat(255) + ' ', code: ' ' + 'c'.repeat(255) + ' ' })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual('n'.repeat(255));
        expect(res.body.data.code).toEqual('c'.repeat(255));
    });

    test.each([
        ['empty', ''],
        ['null', null]
    ])('should fail if the name is %s', async (_, name) => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ name })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if the amount quota is 0', async () => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ quota_amount: 0 })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('quota_amount');
    });

    test('should accept an integration without a description and return it as null', async () => {
        const res = await request({
            path: '/integrations',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateIntegration({ code: 'no-description' })
        });

        expect(res.statusCode).toEqual(200);

        const integrationFromDb = await Integration.findByPk(res.body.data.id);
        expect(integrationFromDb.description).toBeNull();
    });
});
