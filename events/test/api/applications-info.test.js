const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid').data;

describe('Events application info', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should return an error if application is not found', async () => {
        const event = await generator.createEvent();

        const res = await request({
            uri: '/single/' + event.id + '/applications/mine',
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should display the application if it exists', async () => {
        const event = await generator.createEvent();
        await generator.createApplication({ user_id: user.id }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/mine',
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });
});
