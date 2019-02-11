const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Events details', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should return a single event on /single/<eventid> GET', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('name');
        expect(res.body.data).toHaveProperty('starts');
        expect(res.body.data).toHaveProperty('ends');
        expect(res.body.data).toHaveProperty('application_status');
        expect(res.body.data).toHaveProperty('max_participants');
        expect(res.body.data).toHaveProperty('status');
        expect(res.body.data).toHaveProperty('type');
        expect(res.body.data).toHaveProperty('organizing_bodies');
        expect(res.body.data).toHaveProperty('description');
        expect(res.body.data).toHaveProperty('questions');
        expect(res.body.data).toHaveProperty('organizers');
        expect(res.body.data).not.toHaveProperty('applications');

        expect(res.body.data.id).toEqual(event.id);
    });

    it('should return a 404 on arbitrary eventids on /single/id GET', async () => {
        const res = await request({
            uri: '/single/1337',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(404);
    });
});
