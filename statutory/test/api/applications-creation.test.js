const moment = require('moment');
const tk = require('timekeeper')

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid-regular-user').data;

describe('Applications creation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should succeed for current user', async () => {
        mock.mockAll({ core: { regularUser: true } })
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({ user_id: null }, event)
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
    });

    test('should succeed for other user when the permissions are okay', async () => {
        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({}, event);

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
        expect(res.body.data.user_id).toEqual(application.user_id);
    });

    test('should return 403 for other user when user does not have permissions', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({}, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

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

    test('should return 400 when current user has already applied', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const application = generator.generateApplication({ user_id: regularUser.id, answers: ['Test'] });
        const event = await generator.createEvent({ applications: [application], questions: ['Test'] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 when submitting an application for user who has already applied', async () => {
        const application = generator.generateApplication({ user_id: regularUser.id, answers: ['Test'] });
        const event = await generator.createEvent({ applications: [application], questions: ['Test'] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 when the application deadline has passed', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({ user_id: null }, event);

        tk.travel(moment(event.application_period_ends).add(5, 'minutes').toDate());

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

    test('should return 403 when the application period hasn\'t started yet', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({}, event);

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

    test('should return 422 on validation errors', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({}, event);
        delete application.body_id;
        delete application.user_id;

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
        expect(res.body.errors).toHaveProperty('body_id')
    });

    test('should return 422 if questions amount is not the same as answers amount', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ questions: ['Test questions?'] });
        const application = generator.generateApplication({ answers: [], user_id: null });

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
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if questions amount if the answers are not set', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ questions: ['Test questions?'] });
        const application = generator.generateApplication();
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
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if some of answers are empty', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ questions: ['Test questions?'] });
        const application = generator.generateApplication({ user_id: regularUser.id, answers: [''] });

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
        expect(res.body.errors).toHaveProperty('answers');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if answers is not an array', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ questions: ['Test questions?'] });
        const application = generator.generateApplication({ user_id: regularUser.id, answers: 'Totally not an array.' });

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
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should remove any additional fields', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ applications: [] });
        const application = generator.generateApplication({ user_id: regularUser.id }, event);

        application.status = 'accepted';
        application.participant_type = 'envoy';
        application.board_comment = 'Awesome guy, accept!';
        application.attended = true;
        application.paid_fee = true;
        application.cancelled = true;
        application.arbitrary_field = 'some garbage'

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
});
