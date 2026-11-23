const nock = require('nock');

const config = require('../../config');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const { Code, Integration } = require('../../models');
const { sequelize } = require('../../lib/sequelize');

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

describe('Codes claiming: parallel claims', () => {
    const PARALLEL = 8;

    // Every token answers as its own user: token-3 is the user with id 1003.
    const mockUsersByToken = () => {
        mock.cleanAll();
        mock.mockCore({ userByToken: (token) => ({ id: 1000 + Number(token.replace('token-', '')) }) });
        mock.mockCoreMainPermissions({});
        mock.mockCoreMailer({});
    };

    const claimInParallel = (integration, tokens) => Promise.all(tokens.map((token) => request({
        path: '/integrations/' + integration.id + '/claim',
        method: 'POST',
        headers: { 'X-Auth-Token': token }
    })));

    // A short pause after each read of the codes widens the window between reading and
    // claiming, so that the parallel requests overlap on every run.
    const slowDown = (method) => {
        const original = Code[method].bind(Code);
        return jest.spyOn(Code, method).mockImplementation(async (...args) => {
            const result = await original(...args);
            await new Promise((resolve) => { setTimeout(resolve, 25); });
            return result;
        });
    };

    beforeEach(async () => {
        mockUsersByToken();
        slowDown('count');
        slowDown('findOne');
        await startServer();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should give the last free code to exactly one of several members claiming at once', async () => {
        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        const code = await generator.createCode({}, integration);

        const tokens = Array.from({ length: PARALLEL }, (_, index) => `token-${index}`);
        const responses = await claimInParallel(integration, tokens);

        const succeeded = responses.filter((res) => res.statusCode === 200);
        const refused = responses.filter((res) => res.statusCode === 403);
        expect(succeeded).toHaveLength(1);
        expect(refused).toHaveLength(PARALLEL - 1);
        refused.forEach((res) => expect(res.body.message).toContain('no codes left'));

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(succeeded[0].body.data.claimed_by);
    });

    test('should give each member claiming at once a different code', async () => {
        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        for (let index = 0; index < PARALLEL / 2; index += 1) {
            await generator.createCode({}, integration);
        }

        const tokens = Array.from({ length: PARALLEL }, (_, index) => `token-${index}`);
        const responses = await claimInParallel(integration, tokens);

        const succeeded = responses.filter((res) => res.statusCode === 200);
        expect(succeeded).toHaveLength(PARALLEL / 2);
        expect(responses.filter((res) => res.statusCode === 403)).toHaveLength(PARALLEL / 2);

        const claimedIds = succeeded.map((res) => res.body.data.id);
        expect(new Set(claimedIds).size).toEqual(PARALLEL / 2);

        const claimedBy = succeeded.map((res) => res.body.data.claimed_by);
        expect(new Set(claimedBy).size).toEqual(PARALLEL / 2);

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id } });
        expect(codesFromDb.map((code) => code.claimed_by).sort()).toEqual([...claimedBy].sort());
    });

    test('should give a member at most their quota when their claims run at once', async () => {
        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        for (let index = 0; index < PARALLEL; index += 1) {
            await generator.createCode({}, integration);
        }

        const tokens = Array.from({ length: PARALLEL }, () => 'token-1');
        const responses = await claimInParallel(integration, tokens);

        const succeeded = responses.filter((res) => res.statusCode === 200);
        const refused = responses.filter((res) => res.statusCode === 403);
        expect(succeeded).toHaveLength(1);
        expect(refused).toHaveLength(PARALLEL - 1);
        refused.forEach((res) => expect(res.body.message).toContain('quota'));

        const claimedCount = await Code.count({ where: { integration_id: integration.id, claimed_by: 1001 } });
        expect(claimedCount).toEqual(1);
    });
});

describe('Codes claiming: waiting for other claims of the integration', () => {
    const BUSY_MESSAGE = 'Other claims of this integration are being processed. Please try again in a moment.';
    let originalClaimConfig;

    // Holds the integration's row lock, as a running claim does, and releases it after `holdFor` ms.
    const holdIntegrationLock = async (integration, holdFor) => {
        const transaction = await sequelize.transaction();
        await Integration.findOne({ where: { id: integration.id }, lock: transaction.LOCK.UPDATE, transaction });
        const released = new Promise((resolve) => { setTimeout(resolve, holdFor); }).then(() => transaction.rollback());
        return { released };
    };

    const claim = (integration) => request({
        path: '/integrations/' + integration.id + '/claim',
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    beforeEach(async () => {
        mock.mockAll();
        originalClaimConfig = config.claim;
        config.claim = { ...config.claim, lockTimeout: 100 };
        await startServer();
    });

    afterEach(async () => {
        config.claim = originalClaimConfig;
        jest.restoreAllMocks();
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should answer 503 and claim nothing when the lock is not free within the lock timeout', async () => {
        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        const code = await generator.createCode({}, integration);

        const { released } = await holdIntegrationLock(integration, 1000);
        const res = await claim(integration);
        await released;

        expect(res.statusCode).toEqual(503);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(BUSY_MESSAGE);

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(null);
    });

    test('should still answer 500 and claim nothing when the database fails during the claim', async () => {
        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        const code = await generator.createCode({}, integration);
        jest.spyOn(Code, 'count').mockRejectedValueOnce(new Error('Database is gone.'));

        const res = await claim(integration);

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);

        const codeFromDb = await Code.findByPk(code.id);
        expect(codeFromDb.claimed_by).toEqual(null);
    });

    test('should claim the code when the lock is free within the lock timeout', async () => {
        config.claim.lockTimeout = 2000;
        const integration = await generator.createIntegration({ quota_period: 'month', quota_amount: 1 });
        const code = await generator.createCode({}, integration);

        const { released } = await holdIntegrationLock(integration, 100);
        const res = await claim(integration);
        await released;

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(code.id);
    });
});
