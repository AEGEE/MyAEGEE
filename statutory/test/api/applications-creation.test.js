const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const { Application } = require('../../models');
const { sequelize } = require('../../lib/sequelize');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { MAIL_FAILURES, spyOnMailFailures, countFailedMails } = require('../scripts/mail-failures');

describe('Applications creation', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        tk.reset();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return 403 when user has an active event application ban', async () => {
        mock.mockAll({ core: { eventApplicationBanned: true }, mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({
                body_id: regularUser.bodies[0].id
            }, event)
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if user can apply within deadline but without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

    test('should succeed for a user with apply permissions but not within deadline', async () => {
        mock.mockAll({ mainPermissions: { applyPermissions: true } });

        const event = await generator.createEvent({ applications: [], type: 'agora' });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        tk.travel(moment(event.application_period_ends).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'string' })]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()] });
        const application = generator.generateApplication({
            answers: [],
            body_id: regularUser.bodies[0].id,
            user_id: null
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()], applications: [] });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id
        });
        delete application.user_id;
        delete application.answers;

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()], applications: [] });
        const application = generator.generateApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: ['']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()], applications: [] });
        const application = generator.generateApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: 'Totally not an array.'
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
        application.confirmed = true;
        application.cancelled = true;
        application.arbitrary_field = 'some garbage';

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
        expect(res.body.data.confirmed).not.toEqual(application.confirmed);
        expect(res.body.data.cancelled).not.toEqual(application.cancelled);

        expect(res.body.data).not.toHaveProperty('arbitrary_field');
    });

    test('should ignore the fields that are not part of the application form', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        // An EPM, as the server sets the memberslist fields itself for an Agora.
        const event = await generator.createEvent({ type: 'epm', applications: [] });
        const otherEvent = await generator.createEvent({ type: 'epm', applications: [] });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        application.id = 123456;
        application.event_id = otherEvent.id;
        application.user_id = regularUser.id + 1000;
        application.body_name = 'Some other body name';
        application.email = 'someone@example.com';
        application.is_on_memberslist = true;
        application.is_on_previous_memberslist = true;
        application.statutory_id = 'some-id';
        application.created_at = '2000-01-01T00:00:00.000Z';

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');

        expect(await Application.count({ where: { event_id: otherEvent.id } })).toEqual(0);

        const applicationFromDb = await Application.findOne({ where: { event_id: event.id } });
        expect(applicationFromDb).not.toEqual(null);
        expect(applicationFromDb.id).not.toEqual(application.id);
        expect(applicationFromDb.user_id).toEqual(regularUser.id);
        expect(applicationFromDb.body_name).toEqual(regularUser.bodies[0].name);
        expect(applicationFromDb.email).toEqual(null);
        expect(applicationFromDb.is_on_memberslist).toEqual(false);
        expect(applicationFromDb.is_on_previous_memberslist).toEqual(false);
        expect(applicationFromDb.statutory_id).not.toEqual(application.statutory_id);
        expect(moment(applicationFromDb.created_at).year()).not.toEqual(2000);

        // The fields of the form are saved.
        expect(applicationFromDb.body_id).toEqual(application.body_id);
        expect(applicationFromDb.meals).toEqual(application.meals);
        expect(applicationFromDb.answers).toEqual(application.answers);
        expect(applicationFromDb.visa_passport_number).toEqual(application.visa_passport_number);
    });

    test('should return 403 if user is not a member of a body', async () => {
        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'text' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'text' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'number' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['NaN']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'select', values: ['valid'] })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['invalid']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['invalid']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'text' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['test']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'number' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [3]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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
            questions: [generator.generateQuestionForEvent({ type: 'select', values: ['valid'] })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: ['valid']
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

    test('should return 422 if the checkbox answer is false', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox', required: true })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [false]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

    test('should return 200 if the answer is valid boolean', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox', required: false })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
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

    test('should fail if user_id is not a number', async () => {
        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const applicationPromise = generator.createApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true],
            user_id: 'invalid'
        }, event);

        expect.assertions(1);
        try {
            await applicationPromise;
        } catch (err) {
            expect(1).toEqual(1);
        }
    });

    const requiredFields = [
        'nationality',
        'number_of_events_visited',
        'meals'
    ];

    for (const field of requiredFields) {
        test(`should return 422 if ${field} is not set`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
                applications: []
            });
            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                answers: [true]
            });
            delete application[field];

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            tk.reset();

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty(field);
        });

        test(`should return 422 if ${field} is empty`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
                applications: []
            });
            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                answers: [true]
            });
            application[field] = '';

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            tk.reset();

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty(field);
        });
    }

    test('should return 422 if number_of_events_visited is not a number', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });
        application.number_of_events_visited = false;

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('number_of_events_visited');
    });

    test('should return 422 if number_of_events_visited is negative', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });
        application.number_of_events_visited = -1;

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('number_of_events_visited');
    });

    test('should return 422 if meals is not one of the allowed options', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });
        application.meals = 'gluten-free';

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('meals');
    });

    test('should return 422 if meat-eater is given but not allowed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            vegetarian: true,
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        }, event);
        application.meals = 'Meat-eater';

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors.meals).toEqual(['Meat-eater is not allowed for this event.']);
        expect(res.body).not.toHaveProperty('data');
        expect(await Application.count()).toEqual(0);
    });

    test('should return 422 when changing the meals to meat-eater if it is not allowed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ vegetarian: true, applications: [] });
        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            meals: 'Vegetarian'
        }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { meals: 'Meat-eater' }
        });

        tk.reset();

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors.meals).toEqual(['Meat-eater is not allowed for this event.']);

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.meals).toEqual('Vegetarian');
    });

    const visaFields = [
        'visa_place_of_birth',
        'visa_passport_number',
        'visa_passport_issue_date',
        'visa_passport_expiration_date',
        'visa_passport_issue_authority',
        'visa_embassy',
        'visa_street_and_house',
        'visa_postal_code',
        'visa_city',
        'visa_country'
    ];

    for (const visaField of visaFields) {
        test(`should return 422 if visa is required, but ${visaField} is not set`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
                applications: []
            });
            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                answers: [true]
            });
            delete application[visaField];

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            tk.reset();

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('visaFieldsFilledIn');
        });

        test(`should return 422 if visa is required, but ${visaField} is null`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
                applications: []
            });
            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                answers: [true]
            });
            application[visaField] = null;

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            tk.reset();

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('visaFieldsFilledIn');
        });

        test(`should return 422 if visa is required, but ${visaField} is not a string`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
                applications: []
            });
            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                answers: [true]
            });
            application[visaField] = false;

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            tk.reset();

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('visaFieldsFilledIn');
        });

        test(`should return 422 if visa is required, but ${visaField} is empty`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
                applications: []
            });
            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                answers: [true]
            });
            application[visaField] = '';

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            tk.reset();

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('visaFieldsFilledIn');
        });
    }

    // The application is saved first. The mails about it are sent afterwards: when one
    // cannot be sent, the application stays, the member gets it back, and the failure is
    // logged with the ids and the template (no addresses) and counted.
    test.each(MAIL_FAILURES)('should save the application and answer 200 when %s', async (description, failure) => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, ...failure });
        const log = spyOnMailFailures();

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const applications = await Application.findAll({ where: { event_id: event.id } });
        expect(applications.length).toEqual(1);
        expect(res.body.data.id).toEqual(applications[0].id);

        const templates = failure.mailer
            ? ['statutory_applied.html', 'statutory_board_applied.html']
            : ['statutory_board_applied.html'];
        expect(log.entries().map((entry) => entry.template).sort()).toEqual(templates);
        for (const entry of log.entries()) {
            expect(entry).toMatchObject({ application_id: applications[0].id, event_id: event.id });
        }
        expect(log.text()).not.toContain(regularUser.notification_email);

        for (const template of templates) {
            expect(await countFailedMails(template)).toBeGreaterThanOrEqual(1);
        }
    });

    test('should skip sending mails to board if there is no board', async () => {
        mock.mockAll({
            mainPermissions: { noPermissions: true },
            bodyMembers: { empty: true },
        });

        const event = await generator.createEvent({
            questions: [generator.generateQuestionForEvent({ type: 'checkbox' })],
            applications: []
        });
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            answers: [true]
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    describe('should update is_on_memberslist for user', () => {
        test('should set is_on_memberslist = true if there\'s an ID match', async () => {
            const event = await generator.createEvent({ type: 'agora' });
            await generator.createMembersList({
                body_id: regularUser.bodies[0].id,
                members: [generator.generateMembersListMember({
                    user_id: regularUser.id,
                    first_name: 'testing',
                    last_name: 'stuff'
                })]
            }, event);

            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id
            }, event);

            tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const applicationFromDb = await Application.findByPk(res.body.data.id);
            expect(applicationFromDb.is_on_memberslist).toEqual(true);
        });

        test('should set is_on_memberslist = false if there\'s the first/last name match', async () => {
            const event = await generator.createEvent({ type: 'agora' });
            await generator.createMembersList({
                body_id: regularUser.bodies[0].id,
                members: [generator.generateMembersListMember({
                    user_id: 300,
                    first_name: regularUser.first_name,
                    last_name: regularUser.last_name
                })]
            }, event);

            const application = generator.generateApplication({
                body_id: regularUser.bodies[0].id
            }, event);

            tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

            const res = await request({
                path: '/events/' + event.id + '/applications/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const applicationFromDb = await Application.findByPk(res.body.data.id);
            expect(applicationFromDb.is_on_memberslist).toEqual(false);
        });
    });

    test('should calculate statutory_id correctly', async () => {
        const event = await generator.createEvent({ applications: [] });

        // user with ID 2 applied first => statutory_id === XXX-0001
        // current user (with ID 1) applied second => statutory_id === XXX-0002
        const firstApplication = await generator.createApplication({ user_id: 2 }, event);
        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(firstApplication.statutory_id).toEqual(event.id.toString().padStart(3, '0') + '-0001');
        expect(res.body.data.statutory_id).toEqual(event.id.toString().padStart(3, '0') + '-0002');
    });

    test('should not reuse a lower statutory_id after an application is deleted', async () => {
        const event = await generator.createEvent({ applications: [] });
        const prefix = event.id.toString().padStart(3, '0');

        const firstApplication = await generator.createApplication({ user_id: 2 }, event);
        const secondApplication = await generator.createApplication({ user_id: 3 }, event);
        await firstApplication.destroy();
        const thirdApplication = await generator.createApplication({ user_id: 4 }, event);

        expect(secondApplication.statutory_id).toEqual(prefix + '-0002');
        expect(thirdApplication.statutory_id).toEqual(prefix + '-0003');
    });

    test('should give different statutory_id to concurrent applications', async () => {
        const event = await generator.createEvent({ applications: [] });

        const applications = await Promise.all([2, 3].map((userId) => sequelize.transaction((t) => Application.create(
            generator.generateApplication({ user_id: userId }, event),
            { transaction: t }
        ))));

        expect(applications.map((application) => application.statutory_id).sort()).toEqual([
            event.id.toString().padStart(3, '0') + '-0001',
            event.id.toString().padStart(3, '0') + '-0002'
        ]);
    });

    test('should prevent applying if cannot assign pax type', async () => {
        const event = await generator.createEvent({ applications: [] });
        await generator.createPaxLimit({
            event_type: event.type,
            body_id: regularUser.bodies[0].id,
            delegate: 0,
            observer: 0,
            visitor: 0,
            envoy: 0
        });

        const application = generator.generateApplication({
            body_id: regularUser.bodies[0].id,
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: application
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    const apply = (event, fields = {}) => request({
        path: '/events/' + event.id + '/applications',
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body: { ...generator.generateApplication({ body_id: regularUser.bodies[0].id }, event), ...fields }
    });

    // Members apply during the application period, both ends included.
    describe('the application period', () => {
        test.each([
            ['refuses an application 1 ms before the period starts', 'application_period_starts', -1, 403],
            ['accepts an application exactly when the period starts (inclusive)', 'application_period_starts', 0, 200],
            ['accepts an application exactly when the period ends (inclusive)', 'application_period_ends', 0, 200],
            ['refuses an application 1 ms after the period ends', 'application_period_ends', 1, 403]
        ])('%s', async (name, field, offset, status) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ applications: [] });
            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await apply(event);

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);
            expect(await Application.count({ where: { event_id: event.id } })).toEqual(status === 200 ? 1 : 0);

            if (status === 403) {
                expect(res.body.message).toEqual('The deadline for applications has passed or the applications period hasn\'t started yet.');
            }
        });

        test.each([
            ['global:apply:agora', 200],
            ['global:manage_applications:agora', 200],
            ['global:apply:epm', 403],
            ['global:manage_applications:epm', 403],
            ['global:manage_incoming:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:manage_event:agora', 403]
        ])('%s alone answers %i after the period of an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            tk.freeze(moment(event.application_period_ends).add(1, 'ms').toDate());

            const res = await apply(event);

            expect(res.statusCode).toEqual(status);
            expect(await Application.count({ where: { event_id: event.id } })).toEqual(status === 200 ? 1 : 0);
        });
    });

    // A member is banned from applying until the moment the ban ends.
    describe('the end of an application ban', () => {
        const banUntil = moment().add(2, 'months').startOf('second');

        const createEventAroundTheEndOfTheBan = () => generator.createEvent({
            applications: [],
            application_period_starts: moment(banUntil).subtract(1, 'week').toDate(),
            application_period_ends: moment(banUntil).add(1, 'week').toDate()
        });

        test.each([
            ['refuses an application 1 ms before the ban ends', -1, 403],
            ['accepts an application exactly when the ban ends (exclusive)', 0, 200],
            ['accepts an application 1 ms after the ban ended', 1, 200]
        ])('%s', async (name, offset, status) => {
            mock.mockAll({
                core: { eventApplicationBanUntil: banUntil.toISOString() },
                mainPermissions: { noPermissions: true }
            });

            const event = await createEventAroundTheEndOfTheBan();
            tk.freeze(moment(banUntil).add(offset, 'ms').toDate());

            const res = await apply(event);

            expect(res.statusCode).toEqual(status);
            expect(await Application.count({ where: { event_id: event.id } })).toEqual(status === 200 ? 1 : 0);

            if (status === 403) {
                expect(res.body).toEqual({ success: false, message: 'You are temporarily banned from applying to events.' });
            }
        });

        test.each([
            'global:apply:agora',
            'global:manage_applications:agora'
        ])('refuses a banned holder of %s too', async (permission) => {
            mock.mockAll({
                core: { eventApplicationBanUntil: banUntil.toISOString() },
                mainPermissions: { permissions: [permission] }
            });

            // After the application period, when only these permissions let a member apply,
            // and a week before the ban ends.
            const event = await generator.createEvent({
                type: 'agora',
                applications: [],
                application_period_starts: moment(banUntil).subtract(3, 'weeks').toDate(),
                application_period_ends: moment(banUntil).subtract(1, 'week').toDate()
            });
            tk.freeze(moment(event.application_period_ends).add(1, 'ms').toDate());

            const res = await apply(event);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are temporarily banned from applying to events.');
            expect(await Application.count({ where: { event_id: event.id } })).toEqual(0);
        });
    });

    describe('the type of the values', () => {
        const createOpenEvent = async () => {
            const event = await generator.createEvent({ applications: [] });
            tk.freeze(moment(event.application_period_starts).toDate());
            return event;
        };

        beforeEach(() => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
        });

        test.each([
            ['a word', 'yes'],
            ['a number other than 0 and 1', 2],
            ['null', null]
        ])('should return 422 if visa_required is %s', async (description, value) => {
            const event = await createOpenEvent();

            const res = await apply(event, { visa_required: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty('visa_required');
            expect(await Application.count({ where: { event_id: event.id } })).toEqual(0);
        });

        test('should not ask for the visa fields when no visa is required', async () => {
            const event = await createOpenEvent();

            const res = await apply(event, {
                visa_required: false,
                visa_place_of_birth: null,
                visa_passport_number: null,
                visa_passport_issue_date: null,
                visa_passport_expiration_date: null,
                visa_passport_issue_authority: null,
                visa_embassy: null,
                visa_street_and_house: null,
                visa_postal_code: null,
                visa_city: null,
                visa_country: null
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.visa_required).toEqual(false);
            expect(res.body.data.visa_passport_number).toEqual(null);
        });

        // BUG: these are refused by the database, not by the validation, so the member gets an
        // internal error for a wrong number. Expected: 422 with errors.number_of_events_visited.
        test.each([
            ['a decimal number', 1.5],
            ['a number above the largest the column holds', 2147483648]
        ])('should return 500 if number_of_events_visited is %s', async (description, value) => {
            const event = await createOpenEvent();

            const res = await apply(event, { number_of_events_visited: value });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(await Application.count({ where: { event_id: event.id } })).toEqual(0);
        });
    });
});
