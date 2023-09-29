const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Campaign details', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the campaign id is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const res = await request({
            uri: '/campaigns/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the campaign name is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const res = await request({
            uri: '/campaigns/xxx',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return less info if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const campaign = await generator.createCampaign();

        const res = await request({
            uri: '/campaigns/' + campaign.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).not.toHaveProperty('autojoin_body_id');
    });

    test('should return some info about the autojoin_body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/campaigns/' + campaign.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('autojoin_body');
        expect(res.body.data.autojoin_body).toHaveProperty('email');
        expect(res.body.data.autojoin_body).not.toHaveProperty('founded_at');
    });

    test('should find the campaign by id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign();

        const res = await request({
            uri: '/campaigns/' + campaign.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(campaign.id);
    });

    test('should find the campaign by url', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign();

        const res = await request({
            uri: '/campaigns/' + campaign.url,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.url).toEqual(campaign.url);
    });
});
