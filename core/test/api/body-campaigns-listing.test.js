const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body campaigns listing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });


    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns',
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
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        await generator.createCampaign({ autojoin_body_id: body.id });
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });
        await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns?limit=1&offset=1', // second one should be returned
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
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const firstCampaign = await generator.createCampaign({ autojoin_body_id: body.id, url: 'aaa' });
        const secondCampaign = await generator.createCampaign({ autojoin_body_id: body.id, url: 'bbb' });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns?sort=url&direction=desc', // second one should be returned
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
