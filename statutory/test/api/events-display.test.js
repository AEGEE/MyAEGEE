const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const Event = require('../../models/Event');

describe('Events listing for single', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return 404 if the event is not found', async () => {
        const res = await request({
            uri: '/event/nonexistant',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should find event by url', async () => {
        const event = await generator.createEvent({ url: 'test-slug' });
        const res = await request({
            uri: '/event/test-slug',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(event.name);
    });

    test('should find event by ID', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/event/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(event.name);
    });
});
