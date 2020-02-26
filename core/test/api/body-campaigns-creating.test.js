const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

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
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const campaign = generator.generateCampaign({ name: '' });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns',
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

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const campaign = generator.generateCampaign();

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns',
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

    test('should override body id', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const campaign = generator.generateCampaign({ body_id: 1337 });

        const res = await request({
            uri: '/bodies/' + body.id + '/campaigns',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: campaign
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).not.toEqual(1337);
    });
});
