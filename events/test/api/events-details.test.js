const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const callers = require('../scripts/callers');
const constants = require('../../lib/constants');

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

    const privateFields = ['budget', 'programme', 'deleted', 'organizers', 'is_european_event'];

    it('should show every field of a draft to its organizer without permissions', async () => {
        callers.asMember();
        const event = await generator.createEvent({ status: 'draft', organizers: [callers.organizer(callers.member)] });

        const res = await request({ path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        for (const field of privateFields) expect(res.body.data).toHaveProperty(field);
        expect(res.body.permissions.edit_event).toEqual(true);
        expect(res.body.permissions.change_status).toEqual({ draft: false, published: false, submitted: true });
    });

    it('should show every field of a draft to an approver of its type', async () => {
        callers.asMember(['global:approve_event:nwm']);
        const event = await generator.createEvent({ status: 'draft', type: 'nwm' });

        const res = await request({ path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        for (const field of privateFields) expect(res.body.data).toHaveProperty(field);
        expect(res.body.permissions.edit_event).toEqual(false);
    });

    it('should not show a draft to an approver of another type', async () => {
        callers.asMember(['global:approve_event:training']);
        const event = await generator.createEvent({ status: 'draft', type: 'nwm' });

        const res = await request({ path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    it('should show the public fields and the permissions of a published event without a valid session', async () => {
        callers.asAnonymous();
        const event = await generator.createEvent({ status: 'published' });

        const res = await request({ path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(Object.keys(res.body.data).sort()).toEqual([...constants.EVENT_PUBLIC_FIELDS].sort());
        expect(res.body.permissions.see_event).toEqual(true);
        expect(res.body.permissions.edit_event).toEqual(false);
        expect(res.body.permissions.set_board_comment).toEqual({});
    });

    it('should show a deleted event to its organizer', async () => {
        callers.asMember();
        const event = await generator.createEvent({ status: 'published', deleted: true, organizers: [callers.organizer(callers.member)] });

        const res = await request({ path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.deleted).toEqual(true);
    });

    it('should return a single event on /single/<eventid> GET by ID', async () => {
        const event = await generator.createEvent();
        const res = await request({
            path: '/single/' + event.id,
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
            path: '/single/' + event.url,
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
            path: '/single/1337',
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
            path: '/single/' + event.id,
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

    it('should return the vegetarian field if the user does not have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'published',
            vegetarian: true,
            organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
        });
        const res = await request({
            path: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).not.toHaveProperty('budget');
        expect(res.body.data.vegetarian).toEqual(true);
    });

    it('should not return event if it\'s deleted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'published',
            deleted: true,
            organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
        });
        const res = await request({
            path: '/single/' + event.id,
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
            path: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });
    describe('event ids that are not stored ids', () => {
        test.each(['1.5', '99999999999', 'Infinity', '1e3', '-1'])('should return 404 for /single/%s', async (id) => {
            await generator.createEvent();

            const res = await request({
                path: '/single/' + id,
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'GET'
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
        });
    });
    test('should find an event by its URL in any letter case', async () => {
        const event = await generator.createEvent({ url: 'case-test-event' });

        const res = await request({
            path: '/single/Case-Test-EVENT',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(event.id);
    });
});
