const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const Event = require('../../models/Event');
const { Application } = require('../../models');
const regularUser = require('../assets/core-valid.json').data;

describe('Applications status', () => {
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
        tk.reset();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should not succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/me/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.status).toEqual('accepted');
    });

    test('should succeed when addressed by statutory ID', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.statutory_id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.status).toEqual('accepted');
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/applications/333/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if status is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'lalala' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed for waiting_list', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'waiting_list' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.status).toEqual('waiting_list');
    });

    test('should return pending if participant list publication date is in the future', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.status).toEqual('pending');
    });

    test('should keep showing status after it was revealed once and deadline moves', async () => {
        const event = await generator.createEvent();
        await event.update({
            participants_list_publish_deadline: moment().subtract(1, 'day').toDate(),
            application_status_revealed_at: null
        });

        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'accepted' }
        });

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const beforeRes = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(beforeRes.statusCode).toEqual(200);
        expect(beforeRes.body.data.status).toEqual('accepted');

        mock.mockAll();

        const editRes = await request({
            path: '/events/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                participants_list_publish_deadline: moment(event.starts).subtract(1, 'day').toDate()
            }
        });

        expect(editRes.statusCode).toEqual(200);

        const updatedEvent = await Event.findOne({ where: { id: event.id } });
        expect(updatedEvent.application_status_revealed_at).toBeTruthy();

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const afterRes = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(afterRes.statusCode).toEqual(200);
        expect(afterRes.body.data.status).toEqual('accepted');
    });

    describe('who may set it', () => {
        test.each([
            ['global:manage_applications:agora', 200],
            ['global:manage_applications:epm', 403],
            ['global:manage_applications:spm', 403],
            ['global:manage_incoming:agora', 403],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:manage_event:agora', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'rejected' }
            });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            // Nothing is stored when the request is refused.
            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.status).toEqual(status === 200 ? 'rejected' : 'accepted');
        });

        test('should return 403 for a board member of the applicant\'s body', async () => {
            // The core mock makes the user a board member of their first body.
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'accepted' }
            });

            expect(res.statusCode).toEqual(403);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.status).toEqual('pending');
        });
    });

    test.each([
        ['an empty string', ''],
        ['a status in capitals', 'ACCEPTED'],
        ['a number', 5]
    ])('should return 422 if status is %s', async (description, value) => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('status');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.status).toEqual('pending');
    });

    test.each([
        ['null', null],
        ['a list', ['accepted']],
        ['an object', { value: 'accepted' }],
        ['true', true]
    ])('should return 422 if status is %s', async (description, value) => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ status: 'waiting_list' }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('status');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.status).toEqual('waiting_list');
    });

    test('should change nothing when the request has no status', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ status: 'waiting_list' }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('waiting_list');
    });

    // The applicant reads "pending" until the event reveals the statuses: from the participants
    // list deadline on, the deadline itself included, or earlier once the event has
    // application_status_revealed_at. Those who manage the applications always read the real one.
    describe('revealing the status of an accepted application', () => {
        let event;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);
        });

        const get = (path) => request({
            path,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // Each route that shows the status, with what it reads for this application, and
        // what it reads before the deadline for those who manage the applications.
        const routes = [
            ['GET /events/:event_id/applications/me', async () => {
                const res = await get('/events/' + event.id + '/applications/me');
                expect(res.statusCode).toEqual(200);
                return res.body.data.status;
            }, 'accepted'],
            ['GET /mine', async () => {
                const res = await get('/mine');
                expect(res.statusCode).toEqual(200);
                expect(res.body.data.length).toEqual(1);
                return res.body.data[0].applications[0].status;
            }, 'accepted'],
            ['GET /events/:event_id/applications/stats', async () => {
                const res = await get('/events/' + event.id + '/applications/stats');
                expect(res.statusCode).toEqual(200);

                const { accepted, pending } = res.body.data.numbers;
                expect(accepted + pending).toEqual(1);
                return accepted === 1 ? 'accepted' : 'pending';
            }, 'accepted']
        ];

        const moments = [
            ['1 ms before the participants list deadline', -1, 'pending'],
            ['exactly at the participants list deadline (inclusive)', 0, 'accepted'],
            ['1 ms after the participants list deadline', 1, 'accepted']
        ];

        describe.each(routes)('%s', (route, readStatus, forManagers) => {
            test.each(moments)('for a member, %s (%i ms) reads "%s"', async (description, offset, status) => {
                mock.mockAll({ mainPermissions: { noPermissions: true } });
                tk.freeze(moment(event.participants_list_publish_deadline).add(offset, 'ms').toDate());

                expect(await readStatus()).toEqual(status);
            });

            test('reads "accepted" before the deadline once the event has revealed the statuses', async () => {
                mock.mockAll({ mainPermissions: { noPermissions: true } });
                await event.update({ application_status_revealed_at: moment(event.application_period_starts).toDate() });
                tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'ms').toDate());

                expect(await readStatus()).toEqual('accepted');
            });

            test(`reads "${forManagers}" before the deadline for those who manage the applications`, async () => {
                mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });
                tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'ms').toDate());

                expect(await readStatus()).toEqual(forManagers);
            });

            test('reads "pending" before the deadline for those who manage the applications of another event type', async () => {
                mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:epm'] } });
                tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'ms').toDate());

                expect(await readStatus()).toEqual('pending');
            });
        });
    });
});
