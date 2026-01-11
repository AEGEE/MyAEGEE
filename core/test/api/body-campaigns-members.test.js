const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body campaign users list', () => {
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
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id + '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });
        const otherUser = await generator.createUser({ campaign_id: campaign.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id + '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(otherUser.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        await generator.createUser({ campaign_id: campaign.id });
        const member = await generator.createUser({ campaign_id: campaign.id });

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id + '/members?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(member.id);

        expect(res.body.meta.count).toEqual(2);
    });

    test('should respect sorting', async () => {
        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        const firstUser = await generator.createUser({
            first_name: 'aaa',
            mail_confirmed_at: new Date(),
            superadmin: true,
            campaign_id: campaign.id
        });
        const token = await generator.createAccessToken(firstUser);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const secondUser = await generator.createUser({ first_name: 'bbb', campaign_id: campaign.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns/' + campaign.id + '/members?sort=first_name&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondUser.id);
        expect(res.body.data[1].id).toEqual(firstUser.id);
    });
});
