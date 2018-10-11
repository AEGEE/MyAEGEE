const moment = require('moment');
const tk = require('timekeeper')

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications editing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should succeed for current user within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 555 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
        expect(res.body.data.body_id).toEqual(555);
    });

    test('should return 403 for current user not within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 555 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed for use who has permissions', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 555 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(application.user_id);
        expect(res.body.data.body_id).toEqual(555);
    });

    test('should return 422 on validation errors', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 'lalala' }
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('body_id')
    });

    test('should return 422 if questions amount is not the same as answers amount', async () => {
        const event = await generator.createEvent({ questions: ['Test questions?'] });
        const application = await generator.createApplication({ answers: ['Test answer'] }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { answers: [] }
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if the application is not found for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 555 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if the application is not found for other user', async () => {
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/333',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 555 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed user_id', async () => {
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/lalala',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 555 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should remove any additional fields', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ participant_type: 'delegate' }, event);

        application.status = 'accepted';
        application.participant_type = 'envoy';
        application.board_comment = 'Awesome guy, accept!';
        application.attended = true;
        application.paid_fee = true;
        application.cancelled = true;
        application.arbitrary_field = 'some garbage'

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(application.user_id);

        expect(res.body.data.status).not.toEqual(application.status);
        expect(res.body.data.participant_type).not.toEqual(application.participant_type);
        expect(res.body.data.board_comment).not.toEqual(application.board_comment);
        expect(res.body.data.attended).not.toEqual(application.attended);
        expect(res.body.data.paid_fee).not.toEqual(application.paid_fee);
        expect(res.body.data.cancelled).not.toEqual(application.cancelled);

        expect(res.body.data).not.toHaveProperty('arbitrary_field');
    });
});
