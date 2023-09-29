const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Campaign } = require('../../models');

describe('Campaigns deleting', () => {
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

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'campaign' });

        const res = await request({
            uri: '/campaigns/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const campaign = await generator.createCampaign();

        const res = await request({
            uri: '/campaigns/' + campaign.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const campaign = await generator.createCampaign();

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'campaign' });

        const res = await request({
            uri: '/campaigns/' + campaign.id,
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
});
