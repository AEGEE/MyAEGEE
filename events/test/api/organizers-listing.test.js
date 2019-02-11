const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid').data;

describe('Event organizing requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should list events where the user is organizer on /mine/organizing GET', async () => {
        const event = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }] });
        const res = await request({
            uri: '/mine/organizing',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should not include events where the user is not organizer on /mine/organizing GET', async () => {
        await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: 1337 }] });
        const res = await request({
            uri: '/mine/organizing',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(0);
    });
});
