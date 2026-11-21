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
});
