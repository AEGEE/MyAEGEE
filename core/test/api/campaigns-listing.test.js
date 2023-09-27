const { startServer, stopServer } = require('../../lib/server');
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
        const token = await generator.createAccessToken(user);

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
        const token = await generator.createAccessToken(user);

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
        const token = await generator.createAccessToken(user);

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
        const token = await generator.createAccessToken(user);

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

    test('should find by name case-sensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'AAA',
            url: 'url1',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        await generator.createCampaign({
            name: 'BBB',
            url: 'url2',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by name case-insensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'aaa',
            url: 'url1',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        await generator.createCampaign({
            name: 'BBB',
            url: 'url2',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by url case-sensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'test',
            url: 'AAA',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        await generator.createCampaign({
            name: 'test',
            url: 'BBB',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by url case-insensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'test',
            url: 'aaa',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        await generator.createCampaign({
            name: 'test',
            url: 'bbb',
            description_short: 'TEST1',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by description_short case-sensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'test',
            url: 'test1',
            description_short: 'AAA',
            description_long: 'ZZZ'
        });

        await generator.createCampaign({
            name: 'test',
            url: 'test2',
            description_short: 'BBB',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by description_short case-insensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'test1',
            url: 'test1',
            description_short: 'aaa',
            description_long: 'ZZZ'
        });

        await generator.createCampaign({
            name: 'test2',
            url: 'test2',
            description_short: 'bbb',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by description_long case-sensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'test',
            url: 'test1',
            description_short: 'test',
            description_long: 'AAA'
        });

        await generator.createCampaign({
            name: 'test',
            url: 'test2',
            description_short: 'test',
            description_long: 'ZZZ'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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

    test('should find by description_long case-insensitive', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'campaign' });

        const campaign = await generator.createCampaign({
            name: 'test1',
            url: 'test1',
            description_short: 'test',
            description_long: 'aaa'
        });

        await generator.createCampaign({
            name: 'test2',
            url: 'test2',
            description_short: 'test',
            description_long: 'bbb'
        });

        const res = await request({
            uri: '/campaigns?query=AAA',
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
});
