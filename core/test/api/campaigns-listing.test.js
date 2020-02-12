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


    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

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
});
