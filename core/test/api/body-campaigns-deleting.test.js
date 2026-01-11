const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Campaign } = require('../../models');

describe('Body campaigns deleting', () => {
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
        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'campaign' });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail for other body\'s campaign', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();
        const otherBody = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'campaign' });

        const campaign = await generator.createCampaign({ autojoin_body_id: otherBody.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'campaign' });

        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const campaignFromDb = await Campaign.findByPk(campaign.id);
        expect(campaignFromDb).toEqual(null);
    });

    test('should succeed on local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'delete', object: 'campaign' });

        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const campaignFromDb = await Campaign.findByPk(campaign.id);
        expect(campaignFromDb).toEqual(null);
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
