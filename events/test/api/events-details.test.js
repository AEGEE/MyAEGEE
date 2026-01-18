const { startServer, stopServer } = require('../../lib/server');
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

    it('should return a single event on /single/<eventid> GET by ID', async () => {
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
        expect(res.body.data).toHaveProperty('meals_per_day');
        expect(res.body.data).toHaveProperty('accommodation_type');
        expect(res.body.data).toHaveProperty('link_info_travel_country');
        expect(res.body.data).toHaveProperty('optional_programme');
        expect(res.body.data).toHaveProperty('optional_fee');
        expect(res.body.data).not.toHaveProperty('applications');

        expect(res.body.data.id).toEqual(event.id);
    });

    it('should return a single event on /single/<eventid> GET by URL', async () => {
        const event = await generator.createEvent({ url: 'test' });
        const res = await request({
            uri: '/single/' + event.url,
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
        expect(res.body.data).toHaveProperty('meals_per_day');
        expect(res.body.data).toHaveProperty('accommodation_type');
        expect(res.body.data).toHaveProperty('link_info_travel_country');
        expect(res.body.data).toHaveProperty('optional_programme');
        expect(res.body.data).toHaveProperty('optional_fee');
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

    it('should not return special fields if the user does not have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'published',
            organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
        });
        const res = await request({
            uri: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).not.toHaveProperty('organizers');
        expect(res.body.data).not.toHaveProperty('budget');
        expect(res.body.data).not.toHaveProperty('programme');
        expect(res.body.data).not.toHaveProperty('deleted');
    });

    it('should not return event if it\'s deleted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'published',
            deleted: true,
            organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
        });
        const res = await request({
            uri: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should not return event if it\'s not published', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'draft',
            deleted: false,
            organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
        });
        const res = await request({
            uri: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });
});
