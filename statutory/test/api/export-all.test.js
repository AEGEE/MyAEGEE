const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const helpers = require('../../lib/helpers');
const constants = require('../../lib/constants');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const users = require('../assets/core-members.json').data;

describe('Export all', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({
            applications: [],
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'string', description: 'test', required: true }
            ]
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // at least 1 sheet

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1); // 1 string in sheet
    });

    test('should return nothing if only cancelled applications', async () => {
        await generator.createApplication({
            cancelled: true,
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1);
    });

    test('should return something if there are not cancelled applications', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            participant_type: 'delegate',
            participant_order: 2,
        }, event);
        await generator.createApplication({
            user_id: users[1].id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 1,
            attended: true,
            confirmed: true,
            incoming: true,
            departed: true,
            registered: true,
            cancelled: false,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(3);
    });

    test('should return 403 if you have no permissions to access', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(403);
    });

    test('should return 400 if no filter provided', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(400);
    });

    test('should work okay with selecting', async () => {
        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: ['id', 'answers.0'] }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2);

        const fields = helpers.getApplicationFields(event);

        // Headers
        expect(sheet[0].length).toEqual(2);
        expect(sheet[0][0]).toEqual(fields.id);
        expect(sheet[0][1]).toEqual(fields['answers.0']);

        // Actual data
        expect(sheet[1].length).toEqual(2);
        expect(sheet[1][0]).toEqual(helpers.beautify(application.id));
        expect(sheet[1][1]).toEqual(helpers.beautify(application.answers[0]));
    });

    test('should filter out selected fields on /incoming', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/incoming',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet[0].length).not.toEqual(Object.keys(helpers.getApplicationFields(event)).length);
        expect(sheet[0].length).toEqual(constants.ALLOWED_INCOMING_FIELDS.length);
    });

    test('should return 400 on invalid prefix', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/invalid',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(400);
    });

    test('should use the default filter if the passed filter is not provided', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 1,
            answers: [true, 'string'],
            status: 'accepted'
        }, event);

        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 2,
            answers: [true, 'string'],
            status: 'rejected'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)), filter: false }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(3); // headers + 2 applications
    });

    test('should use the filter if provided', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted',
            confirmed: true
        }, event);

        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'rejected'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: Object.keys(helpers.getApplicationFields(event)),
                filter: { status: 'accepted', confirmed: true }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
    });

    test('should work with all the fields the filter supports', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted',
            confirmed: true,
            participant_type: 'envoy',
            participant_order: 1
        }, event);

        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted',
            confirmed: true,
            participant_type: 'visitor',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: Object.keys(helpers.getApplicationFields(event)),
                filter: {
                    status: 'accepted',
                    cancelled: false,
                    confirmed: true,
                    incoming: false,
                    participant_type: 'envoy'
                }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
    });

    test('should return 400 if the filter has a field other than the supported ones', async () => {
        const otherEvent = await generator.createEvent({ applications: [] });
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id
        }, otherEvent);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: Object.keys(helpers.getApplicationFields(event)),
                filter: { event_id: otherEvent.id }
            }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(/event_id/);
    });

    test('should return 400 if a filter value is not a plain value or a list of them', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all?filter[status][accepted]=true',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(/status/);
    });

    test.each([
        ['an unknown status', 'filter[status]=unknown', 'status'],
        ['an empty status', 'filter[status]=', 'status'],
        ['a flag that is not a boolean', 'filter[confirmed]=maybe', 'confirmed'],
        ['an unknown participant type', 'filter[participant_type]=chair', 'participant_type']
    ])('should return 400 if the filter has %s', async (name, query, field) => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all?' + query,
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(new RegExp(field));
    });

    test('should ignore the passed filter on /incoming', async () => {
        const otherEvent = await generator.createEvent({ applications: [] });
        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            status: 'accepted'
        }, otherEvent);

        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/incoming',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: ['id', 'statutory_id'],
                filter: { event_id: otherEvent.id }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
        expect(sheet[1][0]).toEqual(application.id);
    });
});
