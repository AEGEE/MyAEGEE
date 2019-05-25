const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const { Application } = require('../../models');
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
        await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });


        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
        expect(res.body.data.body_id).toEqual(regularUser.bodies[0].id);
    });

    test('should return 403 for current user not within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
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
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.body_id).toEqual(regularUser.bodies[0].id);
    });

    test('should return 422 on validation errors', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { visa_required: 'nope' }
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('visa_required');
    });

    test('should return 422 if questions amount is not the same as answers amount', async () => {
        const event = await generator.createEvent({ questions: [generator.generateQuestion()] });
        const application = await generator.createApplication({ answers: ['Test answer'] }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { answers: [] }
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should work okay if some questions were changed', async () => {
        const event = await generator.createEvent({ questions: [generator.generateQuestion()] });
        const application = await generator.createApplication({ answers: ['Test answer'] }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { answers: ['Another test answer'] }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should return 404 if the application is not found for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
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

    test('should remove any additional fields', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({
            participant_type: 'delegate',
            body_id: regularUser.bodies[0].id
        }, event);

        application.status = 'accepted';
        application.participant_type = 'envoy';
        application.board_comment = 'Awesome guy, accept!';
        application.attended = true;
        application.paid_fee = true;
        application.cancelled = true;
        application.arbitrary_field = 'some garbage';

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
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

    test('should return 403 when applying not on behalf of the user body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({
            user_id: regularUser.id,
        }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 1337 }
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should reset pax type and board comment when switching body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 1,
            board_comment: 'Awesome guy, accept'
        }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[1].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.participant_type).toEqual(null);
        expect(res.body.data.participant_order).toEqual(null);
        expect(res.body.data.board_comment).toEqual(null);

        const newApplication = await Application.findOne({ where: { id: application.id } });
        expect(newApplication.participant_type).toEqual(null);
        expect(newApplication.participant_order).toEqual(null);
        expect(newApplication.board_comment).toEqual(null);
    });

    test('should not reset pax type and board comment when switching body for other user', async () => {
        mock.mockAll();

        const event = await generator.createEvent();
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 1,
            board_comment: 'Awesome guy, accept'
        }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[1].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.participant_type).toEqual('envoy');
        expect(res.body.data.board_comment).toEqual('Awesome guy, accept');

        const newApplication = await Application.findOne({ where: { id: application.id } });
        expect(newApplication.participant_type).toEqual('envoy');
        expect(newApplication.participant_order).toEqual(1);
        expect(newApplication.board_comment).toEqual('Awesome guy, accept');
    });

    test('should return 500 if members query returns net error', async () => {
        mock.mockAll({ member: { netError: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 500 if members query returns bad response', async () => {
        mock.mockAll({ member: { badResponse: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 500 if members query returns unsuccessful response', async () => {
        mock.mockAll({ member: { unsuccessfulResponse: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 500 and not save application if mailer returns net error', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ visa_required: true }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { visa_required: false }
        });

        tk.reset();

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.visa_required).not.toEqual(false);
    });

    test('should return 500 and not save application if mailer returns bad response', async () => {
        mock.mockAll({ mailer: { badResponse: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ visa_required: true }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { visa_required: false }
        });

        tk.reset();

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.visa_required).not.toEqual(false);
    });

    test('should return 500 and not save application if mailer returns unsuccessful response', async () => {
        mock.mockAll({ mailer: { unsuccessfulResponse: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ visa_required: true }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { visa_required: false }
        });

        tk.reset();

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.visa_required).not.toEqual(false);
    });
});
