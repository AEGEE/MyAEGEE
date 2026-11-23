const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const { Application } = require('../../models');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { MAIL_FAILURES, spyOnMailFailures, countFailedMails } = require('../scripts/mail-failures');

describe('Applications editing', () => {
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

    test('should succeed for current user within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/me',
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
            path: '/events/' + event.id + '/applications/' + application.id,
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

    test('should return 403 for current user with an accepted application', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        // First, change status to accepted with full permissions (from beforeEach mock).
        await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        // Then re-mock with no permissions so the user can only edit their own application.
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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

    test('should succeed for user with apply permissions for own application after the deadline', async () => {
        mock.mockAll({ mainPermissions: { applyPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_ends).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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

    test('should return 403 for user with apply permissions for other user application', async () => {
        mock.mockAll({ mainPermissions: { applyPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        const application = await generator.createApplication({ user_id: 1337 }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const unchangedApplication = await Application.findOne({ where: { id: application.id } });
        expect(unchangedApplication.body_id).toEqual(application.body_id);
    });

    test('should return 403 for user with apply permissions with an accepted application', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        tk.travel(moment(event.application_period_ends).add(5, 'minutes').toDate());

        mock.mockAll({ mainPermissions: { applyPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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

    test('should succeed for user who has permissions', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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
            path: '/events/' + event.id + '/applications/' + application.id,
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
        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()] });
        const application = await generator.createApplication({ answers: ['Test answer'] }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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
        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()] });
        const application = await generator.createApplication({ answers: ['Test answer'] }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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
            path: '/events/' + event.id + '/applications/me',
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
            path: '/events/' + event.id + '/applications/333',
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
        const otherEvent = await generator.createEvent();
        const application = await generator.createApplication({
            participant_type: 'delegate',
            body_id: regularUser.bodies[0].id
        }, event);

        application.event_id = otherEvent.id;

        application.status = 'accepted';
        application.participant_type = 'envoy';
        application.board_comment = 'Awesome guy, accept!';
        application.attended = true;
        application.confirmed = true;
        application.cancelled = true;
        application.arbitrary_field = 'some garbage';

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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

        expect(res.body.data.event_id).toEqual(event.id);
        expect(await Application.count({ where: { event_id: otherEvent.id } })).toEqual(0);
        expect(res.body.data.status).not.toEqual(application.status);
        expect(res.body.data.participant_type).not.toEqual(application.participant_type);
        expect(res.body.data.board_comment).not.toEqual(application.board_comment);
        expect(res.body.data.attended).not.toEqual(application.attended);
        expect(res.body.data.confirmed).not.toEqual(application.confirmed);
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
            path: '/events/' + event.id + '/applications/' + application.id,
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
        await generator.createPaxLimit({
            event_type: event.type,
            body_id: regularUser.bodies[1].id,
            delegate: 1,
            observer: 0,
            visitor: 0,
            envoy: 0
        });
        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 1,
            board_comment: 'Awesome guy, accept'
        }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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
        // The applicant is not in the board of the new body, so does not get the board comment back.
        expect(res.body.data).not.toHaveProperty('board_comment');

        const newApplication = await Application.findOne({ where: { id: application.id } });
        expect(newApplication.participant_type).toEqual(null);
        expect(newApplication.participant_order).toEqual(null);
        expect(newApplication.board_comment).toEqual(null);
    });

    test('should reset pax type and board comment when switching body for other user', async () => {
        mock.mockAll();

        const event = await generator.createEvent();
        await generator.createPaxLimit({
            event_type: event.type,
            body_id: regularUser.bodies[1].id,
            delegate: 1,
            observer: 0,
            visitor: 0,
            envoy: 0
        });
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 1,
            board_comment: 'Awesome guy, accept'
        }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[1].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).toEqual(regularUser.bodies[1].id);
        expect(res.body.data.participant_type).toEqual(null);
        expect(res.body.data.participant_order).toEqual(null);
        expect(res.body.data.board_comment).toEqual(null);

        const newApplication = await Application.findOne({ where: { id: application.id } });
        expect(newApplication.participant_type).toEqual(null);
        expect(newApplication.participant_order).toEqual(null);
        expect(newApplication.board_comment).toEqual(null);
    });

    test('should return 403 when switching to a body without pax limits for other user', async () => {
        mock.mockAll();

        const event = await generator.createEvent();
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id
        }, event);
        await generator.createPaxLimit({
            event_type: event.type,
            body_id: regularUser.bodies[1].id,
            delegate: 0,
            observer: 0,
            visitor: 0,
            envoy: 0
        });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[1].id }
        });

        tk.reset();

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const unchangedApplication = await Application.findOne({ where: { id: application.id } });
        expect(unchangedApplication.body_id).toEqual(regularUser.bodies[0].id);
    });

    test('should return 500 if members query returns net error', async () => {
        mock.mockAll({ member: { netError: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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
            path: '/events/' + event.id + '/applications/' + application.id,
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
            path: '/events/' + event.id + '/applications/' + application.id,
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

    // The edit is saved first. The mails about it are sent afterwards: when one cannot be
    // sent, the edit stays and the failure is logged with the ids and the template and counted.
    test.each(MAIL_FAILURES)('should save the edit and answer 200 when %s', async (description, failure) => {
        mock.mockAll(failure);
        const log = spyOnMailFailures();

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ visa_required: true }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { visa_required: false }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.visa_required).toEqual(false);

        const updated = await Application.findByPk(application.id);
        expect(updated.visa_required).toEqual(false);

        const templates = failure.mailer
            ? ['statutory_board_edited.html', 'statutory_edited.html']
            : ['statutory_board_edited.html'];
        expect(log.entries().map((entry) => entry.template).sort()).toEqual(templates);
        for (const entry of log.entries()) {
            expect(entry).toMatchObject({ application_id: application.id, event_id: event.id });
        }
        expect(log.text()).not.toContain('@');

        for (const template of templates) {
            expect(await countFailedMails(template)).toBeGreaterThanOrEqual(1);
        }
    });

    test('should skip mailing the board if no board', async () => {
        mock.mockAll({ bodyMembers: { empty: true } });

        const event = await generator.createEvent({ questions: [generator.generateQuestionForEvent()] });
        const application = await generator.createApplication({ answers: ['Test answer'] }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
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

    describe('fields that are not part of the application form', () => {
        let event;
        let otherEvent;
        let application;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            // An EPM, as the server sets the memberslist fields itself for an Agora.
            event = await generator.createEvent({ type: 'epm' });
            otherEvent = await generator.createEvent({ type: 'epm' });
            application = await generator.createApplication({
                user_id: regularUser.id,
                body_id: regularUser.bodies[0].id
            }, event);

            tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());
        });

        afterEach(() => {
            tk.reset();
        });

        test('should ignore them when the applicant sends them', async () => {
            const res = await request({
                path: '/events/' + event.id + '/applications/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: {
                    id: application.id + 1000,
                    event_id: otherEvent.id,
                    user_id: regularUser.id + 1000,
                    body_name: 'Some other body name',
                    email: 'someone@example.com',
                    is_on_memberslist: true,
                    is_on_previous_memberslist: true,
                    created_at: '2000-01-01T00:00:00.000Z',
                    allergies: 'Updated allergies'
                }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');

            expect(await Application.count({ where: { event_id: otherEvent.id } })).toEqual(0);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb).not.toEqual(null);
            expect(applicationFromDb.event_id).toEqual(event.id);
            expect(applicationFromDb.user_id).toEqual(regularUser.id);
            expect(applicationFromDb.body_name).toEqual(application.body_name);
            expect(applicationFromDb.email).toEqual(null);
            expect(applicationFromDb.is_on_memberslist).toEqual(false);
            expect(applicationFromDb.is_on_previous_memberslist).toEqual(false);
            expect(applicationFromDb.created_at).toEqual(application.created_at);

            // The fields of the form are still saved.
            expect(applicationFromDb.allergies).toEqual('Updated allergies');
        });

        test('should ignore the registered flag when the applicant sends it', async () => {
            // The model accepts registered only on a confirmed application.
            await application.update({ confirmed: true });

            const res = await request({
                path: '/events/' + event.id + '/applications/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { registered: true, allergies: 'Updated allergies' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.registered).toEqual(false);
            expect(applicationFromDb.allergies).toEqual('Updated allergies');
        });

        test('should succeed when the whole application is sent back, as the edit form does', async () => {
            const fetched = await request({
                path: '/events/' + event.id + '/applications/me',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(fetched.statusCode).toEqual(200);
            expect(fetched.body.data).toHaveProperty('permissions');
            expect(fetched.body.data).toHaveProperty('editable_bodies');

            const res = await request({
                path: '/events/' + event.id + '/applications/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { ...fetched.body.data, meals: 'Vegan', allergies: 'Updated allergies' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.meals).toEqual('Vegan');
            expect(applicationFromDb.allergies).toEqual('Updated allergies');

            // Everything else stays as it was, except for the fields taken from the member's profile.
            const profileFields = ['first_name', 'last_name', 'gender', 'date_of_birth', 'body_name'];
            const unchangedFields = Object.keys(application.toJSON())
                .filter((field) => !['meals', 'allergies', 'updated_at', ...profileFields].includes(field));
            for (const field of unchangedFields) {
                expect(applicationFromDb[field]).toEqual(application[field]);
            }
        });
    });

    const edit = (event, applicationId, body = { allergies: 'Changed' }) => request({
        path: '/events/' + event.id + '/applications/' + applicationId,
        method: 'PUT',
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const expectStored = async (application, changed) => {
        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.allergies).toEqual(changed ? 'Changed' : application.allergies);
    };

    // Applicants edit their application during the application period, both ends included.
    describe('the application period', () => {
        test.each([
            ['refuses the applicant 1 ms before the period starts', 'application_period_starts', -1, 403],
            ['lets the applicant edit exactly when the period starts (inclusive)', 'application_period_starts', 0, 200],
            ['lets the applicant edit exactly when the period ends (inclusive)', 'application_period_ends', 0, 200],
            ['refuses the applicant 1 ms after the period ends', 'application_period_ends', 1, 403]
        ])('%s', async (name, field, offset, status) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id, allergies: 'Before' }, event);

            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await edit(event, 'me');

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);
            await expectStored(application, status === 200);

            if (status === 403) {
                expect(res.body).toEqual({ success: false, message: 'You cannot edit this application.' });
            }
        });

        test.each([
            ['global:apply:agora', 200],
            ['global:manage_applications:agora', 200],
            ['global:apply:epm', 403],
            ['global:manage_applications:epm', 403],
            ['global:manage_incoming:agora', 403],
            ['global:approve_members:agora', 403]
        ])('%s alone answers the applicant with %i after the period of an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id, allergies: 'Before' }, event);

            tk.freeze(moment(event.application_period_ends).add(1, 'ms').toDate());

            const res = await edit(event, 'me');

            expect(res.statusCode).toEqual(status);
            await expectStored(application, status === 200);
        });
    });

    // Applicants edit their application until it is accepted.
    describe('the status of the application', () => {
        test.each([
            ['pending', 200],
            ['waiting_list', 200],
            ['rejected', 200],
            ['accepted', 403]
        ])('answers the applicant of a "%s" application with %i within the period', async (applicationStatus, status) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({
                user_id: regularUser.id,
                status: applicationStatus,
                allergies: 'Before'
            }, event);

            tk.freeze(moment(event.application_period_starts).toDate());

            const res = await edit(event, 'me');

            expect(res.statusCode).toEqual(status);
            await expectStored(application, status === 200);
        });

        test('lets those who manage the applications edit an accepted application', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted', allergies: 'Before' }, event);

            const res = await edit(event, application.id);

            expect(res.statusCode).toEqual(200);
            await expectStored(application, true);
        });
    });

    describe('who may edit somebody else\'s application', () => {
        test.each([
            ['global:manage_applications:agora', 200],
            ['global:manage_applications:epm', 403],
            ['global:manage_incoming:agora', 403],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:apply:agora', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            // Accepted, so that the local organisers reach the application too.
            const application = await generator.createApplication({ user_id: 2, status: 'accepted', allergies: 'Before' }, event);

            // Within the period, when applicants may edit their own.
            tk.freeze(moment(event.application_period_starts).toDate());

            const res = await edit(event, application.id);

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);
            await expectStored(application, status === 200);
        });

        test('should return 403 for a board member of the applicant\'s body', async () => {
            // The core mock makes the user a board member of their first body.
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({
                user_id: 2,
                body_id: regularUser.bodies[0].id,
                allergies: 'Before'
            }, event);

            tk.freeze(moment(event.application_period_starts).toDate());

            const res = await edit(event, application.id);

            expect(res.statusCode).toEqual(403);
            await expectStored(application, false);
        });
    });

    // BUG: these are refused by the database, not by the validation, so the member gets an
    // internal error for a wrong number. Expected: 422 with errors.number_of_events_visited.
    test.each([
        ['a decimal number', 1.5],
        ['a number above the largest the column holds', 2147483648]
    ])('should return 500 if number_of_events_visited is %s', async (description, value) => {
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: 2, number_of_events_visited: 3 }, event);

        const res = await edit(event, application.id, { number_of_events_visited: value });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.number_of_events_visited).toEqual(3);
    });
});
