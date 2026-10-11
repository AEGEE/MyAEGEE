const nock = require('nock');

const config = require('../../config');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const { Code } = require('../../models');

describe('Codes claiming', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should fail if the integration is not found', async () => {
        const res = await request({
            path: '/integrations/1337/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the user claimed codes already', async () => {
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 1
        });

        // The user has claimed the code.
        await generator.createCode({ claimed_by: user.id }, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the user claimed codes already for daily quota', async () => {
        const integration = await generator.createIntegration({
            quota_period: 'day',
            quota_amount: 1
        });

        await generator.createCode({ claimed_by: user.id }, integration);

        const res = await request({
            uri: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the user claimed codes already for yearly quota', async () => {
        const integration = await generator.createIntegration({
            quota_period: 'year',
            quota_amount: 1
        });

        await generator.createCode({ claimed_by: user.id }, integration);

        const res = await request({
            uri: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are no codes', async () => {
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 1
        });
        // no codes

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed and return code if available', async () => {
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 1
        });

        // 1 code available
        const code = await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.id).toEqual(code.id);
        expect(res.body.data.claimed_by).toEqual(user.id);

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(user.id);
    });

    test('should send expected payload to mailer when code is claimed', async () => {
        mock.cleanAll();
        mock.mockCore({});
        mock.mockCoreMainPermissions({});

        const integration = await generator.createIntegration({
            name: 'Flixbus',
            quota_period: 'month',
            quota_amount: 1,
            description: 'Ride cheaper'
        });
        const code = await generator.createCode({ value: 'CLAIM-ME' }, integration);

        const mailerScope = nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/', (body) => body.to === user.notification_email
                && body.subject === 'Your Flixbus discount code'
                && body.template === 'custom.html'
                && body.parameters
                && typeof body.parameters.body === 'string'
                && body.parameters.body.includes('Partner: Flixbus')
                && body.parameters.body.includes('Code: CLAIM-ME')
                && body.parameters.body.includes('Ride cheaper'))
            .reply(200, { success: true });

        const res = await request({
            uri: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(code.id);
        expect(mailerScope.isDone()).toEqual(true);
    });

    test('should find integration by code when claiming', async () => {
        const integration = await generator.createIntegration({
            code: 'flixbus',
            quota_period: 'month',
            quota_amount: 1
        });
        const code = await generator.createCode({}, integration);

        const res = await request({
            uri: '/integrations/flixbus/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(code.id);
        expect(res.body.data.claimed_by).toEqual(user.id);
    });

    test('should return 404 for malformed numeric-like integration IDs when claiming', async () => {
        const res = await request({
            uri: '/integrations/1e3/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 500 if mailer returns net error', async () => {
        mock.mockAll({ mailer: { netError: true } });
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 1
        });

        // 1 code available
        await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 500 if mailer returns bad response', async () => {
        mock.mockAll({ mailer: { badResponse: true } });
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 1
        });

        // 1 code available
        await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 500 if mailer returns unsuccessful response', async () => {
        mock.mockAll({ mailer: { unsuccessfulResponse: true } });
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 1
        });

        // 1 code available
        await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
