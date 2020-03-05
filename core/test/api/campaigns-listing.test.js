const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Campaigns list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createCampaign();

        const res = await request({
            uri: '/campaigns',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign();

        const res = await request({
            uri: '/campaigns',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(campaign.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        await generator.createCampaign();
        const campaign = await generator.createCampaign();
        await generator.createCampaign();

        const res = await request({
            uri: '/campaigns?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(campaign.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const firstCampaign = await generator.createCampaign({ url: 'aaa' });
        const secondCampaign = await generator.createCampaign({ url: 'bbb' });

        const res = await request({
            uri: '/campaigns?sort=url&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondCampaign.id);
        expect(res.body.data[1].id).toEqual(firstCampaign.id);
    });
});
