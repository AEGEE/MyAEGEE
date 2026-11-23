const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Campaign } = require('../../models');

describe('Campaign editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the campaign is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'campaign' });

        const res = await request({
            path: '/campaigns/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'campaign' });

        const campaign = await generator.createCampaign();

        const res = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: '' }
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

        const campaign = await generator.createCampaign();

        const res = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'campaign' });

        const campaign = await generator.createCampaign();

        const res = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual('New name');
    });

    test('should allow changing autojoin_body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'update', object: 'campaign' });

        const campaign = await generator.createCampaign();

        const res = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { autojoin_body_id: body.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const campaignFromDb = await Campaign.findByPk(campaign.id);
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
        await generator.createPermission({ scope: 'global', action: 'update', object: 'campaign' });

        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'Renamed', autojoin_body_id: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, errors: { autojoin_body_id: ['The body does not exist.'] } });

        const campaignFromDb = await Campaign.findByPk(campaign.id);
        expect(campaignFromDb.autojoin_body_id).toEqual(body.id);
        expect(campaignFromDb.name).toEqual(campaign.name);
    });

    test('should change and unset the body that new members join', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'update', object: 'campaign' });

        const body = await generator.createBody();
        const otherBody = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const changed = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { autojoin_body_id: String(otherBody.id) }
        });

        expect(changed.statusCode).toEqual(200);
        expect((await Campaign.findByPk(campaign.id)).autojoin_body_id).toEqual(otherBody.id);

        const unset = await request({
            path: '/campaigns/' + campaign.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { autojoin_body_id: null }
        });

        expect(unset.statusCode).toEqual(200);
        expect((await Campaign.findByPk(campaign.id)).autojoin_body_id).toEqual(null);
    });
});
