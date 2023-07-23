const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Codes displaying', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should return my codes with integrations', async () => {
        const integration = await generator.createIntegration();

        // 1 code available
        const code = await generator.createCode({ claimed_by: user.id }, integration);

        const res = await request({
            uri: '/codes/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(code.id);
        expect(res.body.data[0].integration.id).toEqual(integration.id);
    });

    test('should not return other users codes with integrations', async () => {
        const integration = await generator.createIntegration();

        // 1 code available
        await generator.createCode({ claimed_by: 1337 }, integration);

        const res = await request({
            uri: '/codes/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(0);
    });
});
