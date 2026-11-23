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

    test.each(['day', 'year'])('should fail if the user claimed codes already for the %s quota', async (quotaPeriod) => {
        const integration = await generator.createIntegration({
            quota_period: quotaPeriod,
            quota_amount: 1
        });

        await generator.createCode({ claimed_by: user.id }, integration);
        // A free code is available, so only the quota can block the claim.
        await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.message).toContain('quota');
    });

    test('should succeed if the user is still under the quota', async () => {
        const integration = await generator.createIntegration({
            quota_period: 'month',
            quota_amount: 2
        });

        await generator.createCode({ claimed_by: user.id }, integration);
        const availableCode = await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(availableCode.id);
        expect(res.body.data.claimed_by).toEqual(user.id);
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
            .post('/', (body) => body.to === 'admin@aegee.org'
                && body.subject === 'Your Flixbus discount code'
                && body.template === 'custom.html'
                && body.parameters.email_body.includes('Partner: Flixbus')
                && body.parameters.email_body.includes('Code: CLAIM-ME')
                && body.parameters.email_body.includes('Ride cheaper'))
            .reply(200, { success: true });

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
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
            path: '/integrations/flixbus/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(code.id);
        expect(res.body.data.claimed_by).toEqual(user.id);
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

describe('Codes claiming: who may claim', () => {
    const CLAIM_MESSAGE = 'Only members of an antenna, contact antenna or contact can claim codes.';

    const makeBody = (id, type, status = 'active') => ({ id, name: `Body ${id}`, type, status });

    const claimAs = async (bodies) => {
        mock.cleanAll();
        mock.mockCore({ user: { bodies } });
        mock.mockCoreMainPermissions({});
        mock.mockCoreMailer({});

        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        const code = await generator.createCode({}, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        return { res, code };
    };

    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test.each(['antenna', 'contact antenna', 'contact'])('should let a member of a body of type %s claim a code', async (type) => {
        const { res, code } = await claimAs([makeBody(1, type)]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(code.id);
    });

    test.each([
        'interest group',
        'working group',
        'commission',
        'committee',
        'project',
        'partner',
        'external',
        'other'
    ])('should not let a member of only a body of type %s claim a code', async (type) => {
        const { res, code } = await claimAs([makeBody(1, type)]);

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(CLAIM_MESSAGE);

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(null);
    });

    test('should not let a user without bodies claim a code', async () => {
        const { res, code } = await claimAs([]);

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(CLAIM_MESSAGE);

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(null);
    });

    test('should not let a user claim a code when core sends no bodies', async () => {
        const { res } = await claimAs(undefined);

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual(CLAIM_MESSAGE);
    });

    test('should not count a membership of a deleted antenna', async () => {
        const { res, code } = await claimAs([makeBody(1, 'antenna', 'deleted'), makeBody(2, 'working group')]);

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual(CLAIM_MESSAGE);

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(null);
    });

    test('should let a member of a deleted antenna and an active contact claim a code', async () => {
        const { res, code } = await claimAs([makeBody(1, 'antenna', 'deleted'), makeBody(2, 'contact')]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(code.id);
    });

    test('should let a member of a working group and an antenna claim a code', async () => {
        const { res, code } = await claimAs([makeBody(1, 'working group'), makeBody(2, 'antenna')]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(code.id);
    });

    test('should still answer 404 for an unknown integration to a user who may not claim', async () => {
        mock.cleanAll();
        mock.mockCore({ user: { bodies: [] } });
        mock.mockCoreMainPermissions({});

        const res = await request({
            path: '/integrations/1337/claim',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
    });
});
