const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const constants = require('../../lib/constants');

describe('Events application boardview', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should include the event of each application, also of deleted events', async () => {
        const event = await generator.createEvent({ deleted: true });
        const application = await generator.createApplication(event, { body_id: user.bodies[0].id });

        const res = await request({ path: '/boardview/' + user.bodies[0].id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((a) => a.id)).toEqual([application.id]);
        expect(res.body.data[0].event.id).toEqual(event.id);
    });

    it('should return an error if you are not a boardmember of this body', async () => {
        const res = await request({
            path: '/boardview/1337',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return an error if bodyId is not a number', async () => {
        const res = await request({
            path: '/boardview/nan',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should display the application of the current body', async () => {
        const body = user.bodies.find((b) => user.circles.some((c) => c.body_id === b.id && c.name.toLowerCase().includes('board')));
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, { body_id: body.id });

        const res = await request({
            path: '/boardview/' + body.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);
    });

    it('should return only the public fields of the event', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const body = user.bodies.find((b) => user.circles.some((c) => c.body_id === b.id && c.name.toLowerCase().includes('board')));
        const event = await generator.createEvent({
            budget: 'https://example.org/budget',
            programme: 'https://example.org/programme',
            organizers: [{ user_id: 4242, first_name: 'Some', last_name: 'Organizer' }]
        });
        await generator.createApplication(event, { body_id: body.id });

        const res = await request({
            path: '/boardview/' + body.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toEqual(1);

        const returned = res.body.data[0].event;
        expect(returned.id).toEqual(event.id);
        expect(returned.name).toEqual(event.name);
        expect(returned.url).toEqual(event.url);
        expect(returned).toHaveProperty('questions');
        for (const field of ['budget', 'programme', 'organizers', 'deleted', 'is_european_event']) {
            expect(returned).not.toHaveProperty(field);
        }
        expect(Object.keys(returned).every((field) => constants.EVENT_PUBLIC_FIELDS.includes(field))).toEqual(true);
    });

    it('should not display the application of other bodies', async () => {
        const body = user.bodies.find((b) => user.circles.some((c) => c.body_id === b.id && c.name.toLowerCase().includes('board')));
        const event = await generator.createEvent({});
        await generator.createApplication(event, { body_id: 1337 });

        const res = await request({
            path: '/boardview/' + body.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(0);
    });
});
