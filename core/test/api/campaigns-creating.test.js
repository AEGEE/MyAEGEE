const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Campaign } = require('../../models');

describe('Campaigns creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'campaign' });

        const campaign = generator.generateCampaign({ name: '' });

        const res = await request({
            path: '/campaigns/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: campaign
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const campaign = generator.generateCampaign();

        const res = await request({
            path: '/campaigns/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: campaign
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'campaign' });

        const campaign = generator.generateCampaign();

        const res = await request({
            path: '/campaigns/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: campaign
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(campaign.name);
    });

    test('should ignore fields that are not allowed', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'create', object: 'campaign' });

        const campaign = generator.generateCampaign({ id: 1337, autojoin_body_id: body.id });

        const res = await request({
            path: '/campaigns',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: campaign
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).not.toEqual(1337);

        const campaignFromDb = await Campaign.findByPk(res.body.data.id);
        expect(campaignFromDb.name).toEqual(campaign.name);
        expect(campaignFromDb.autojoin_body_id).toEqual(body.id);
    });

    test.each([
        ['does not exist', 2147483647],
        ['is a text that is not a number', 'abc'],
        ['is a list', [1]],
        ['is an object', { id: 1 }],
        ['is a fraction', 1.5]
    ])('should fail if the body that new members join %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'create', object: 'campaign' });

        const res = await request({
            path: '/campaigns',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: generator.generateCampaign({ autojoin_body_id: value })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, errors: { autojoin_body_id: ['The body does not exist.'] } });
        expect(await Campaign.count()).toEqual(0);
    });

    test('should create a campaign without a body that new members join', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'create', object: 'campaign' });

        const res = await request({
            path: '/campaigns',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: generator.generateCampaign({ autojoin_body_id: null })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.autojoin_body_id).toEqual(null);
    });

    test.each([
        ['written the same', 'summer-university'],
        ['written in another case and with spaces around it', ' Summer-University ']
    ])('should fail if another campaign has the url, %s', async (name, url) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'create', object: 'campaign' });

        const existing = await generator.createCampaign({ url: 'summer-university' });

        const res = await request({
            path: '/campaigns',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: generator.generateCampaign({ url })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, errors: { url: ['url must be unique'] } });

        const campaigns = await Campaign.findAll();
        expect(campaigns.map((campaign) => campaign.id)).toEqual([existing.id]);
    });
});
