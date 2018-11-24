const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications creation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should succeed if user can apply within deadline but without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({
                body_id: regularUser.bodies[0].id
            }, event)
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
    });

    test('should succeed for a user with permissions but not within deadline', async () => {
        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });


        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
    });

    test('should return 403 when user does not have permissions and not within deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 422 when user has already applied', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const application = generator.generateApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: ['Test']
        });
        const event = await generator.createEvent({
            applications: [application],
            questions: [generator.generateQuestion({ type: 'string' })]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
    });

    test('should return 422 if questions amount is not the same as answers amount', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ questions: [generator.generateQuestion()] });
        const application = generator.generateApplication({
            answers: [],
            body_id: regularUser.bodies[0].id,
            user_id: null
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 422 if questions amount if the answers are not set', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ questions: [generator.generateQuestion()], applications: [] });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id
        });
        delete application.user_id;
        delete application.answers;

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 422 if some of answers are empty', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ questions: [generator.generateQuestion()], applications: [] });
        const application = generator.generateApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: ['']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 422 if answers is not an array', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ questions: [generator.generateQuestion()], applications: [] });
        const application = generator.generateApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: 'Totally not an array.'
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should remove any additional fields', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({
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
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);

        expect(res.body.data.status).not.toEqual(application.status);
        expect(res.body.data.participant_type).not.toEqual(application.participant_type);
        expect(res.body.data.board_comment).not.toEqual(application.board_comment);
        expect(res.body.data.attended).not.toEqual(application.attended);
        expect(res.body.data.paid_fee).not.toEqual(application.paid_fee);
        expect(res.body.data.cancelled).not.toEqual(application.cancelled);

        expect(res.body.data).not.toHaveProperty('arbitrary_field');
    });

    test('should return 403 if user is not a member of a body', async () => {
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({
                body_id: 1337
            }, event)
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 200 if the text answer is not a text', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'text' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });


    test('should return 422 if the text answer is empty, although required', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'text' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 422 if the number answer is not a number', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'number' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['NaN']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 422 if the select answer is not in values', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'select', values: ['valid'] })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['invalid']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 422 if the select answer is not in values', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['invalid']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('answers');
    });

    test('should return 200 if the text answer is not empty and required', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'text' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['test']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should return 200 if the number answer is a number', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'number' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [3]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should return 200 if the select answer is in values', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'select', values: ['valid'] })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['valid']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should return 200 if the select answer is in values', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestion({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });
});
