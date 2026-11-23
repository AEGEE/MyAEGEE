const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Applications boardview list', () => {
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

    test('should display everything if the user has local permissions on /boardview/:id', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);
    });

    test('should fail if the user doesn\'t have local permissions for the body on /boardview/:id', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if the user has global permissions for his body', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);
    });

    test('should succeed if the user has global permissions for random body', async () => {
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ body_id: 1337 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);
    });

    test('should result in an error if :id is malformed', async () => {
        const event = await generator.createEvent();
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/invalid',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should sort applications', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const applications = [
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 1,
                participant_type: 'delegate',
                participant_order: 1
            }, event),
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 2,
                participant_type: 'delegate',
                participant_order: 2
            }, event),
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 3,
                participant_type: 'visitor',
                participant_order: 1
            }, event),
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 4,
                participant_type: 'visitor',
                participant_order: 2
            }, event),
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 5,
                participant_type: 'visitor',
                participant_order: 3
            }, event),
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 6,
                participant_type: null,
                participant_order: null
            }, event),
            await generator.createApplication({
                body_id: regularUser.bodies[0].id,
                user_id: 7,
                participant_type: null,
                participant_order: null
            }, event),
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(7);
        expect(res.body.data[0].id).toEqual(applications[0].id);
        expect(res.body.data[1].id).toEqual(applications[1].id);
        expect(res.body.data[2].id).toEqual(applications[2].id);
        expect(res.body.data[3].id).toEqual(applications[3].id);
        expect(res.body.data[4].id).toEqual(applications[4].id);
        expect(res.body.data[5].id).toEqual(applications[5].id);
        expect(res.body.data[6].id).toEqual(applications[6].id);
    });

    test('should return an empty list for a body without applications', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    test('should list only the applications of that body and of that event', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const otherEvent = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id }, event);
        await generator.createApplication({ user_id: 3, body_id: 1337 }, event);
        await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id }, otherEvent);

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((row) => row.id)).toEqual([application.id]);
        expect(res.body.data[0].board_comment).toEqual(application.board_comment);
        expect(res.body.data[0].notification_email).toEqual('test@example.com');
    });

    test('should return 403 for a board member of another body', async () => {
        // The core mock makes the user a board member of their first body only.
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        await generator.createApplication({ body_id: 1337 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    // Seeing the board view has no deadline, unlike setting the participant types.
    test.each([
        ['1 ms before the application period starts', 'application_period_starts', -1],
        ['1 ms after the board approve deadline', 'board_approve_deadline', 1]
    ])('should display the board view to a board member %s', async (name, field, offset) => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ body_id: regularUser.bodies[0].id }, event);

        tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((row) => row.id)).toEqual([application.id]);
    });

    describe('who may see it without being in the board of the body', () => {
        // Managing the applications does not open the board view.
        test.each([
            ['global:approve_members:agora', 200],
            ['global:approve_members:epm', 403],
            ['global:manage_applications:agora', 403],
            ['global:manage_incoming:agora', 403],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({
                mainPermissions: { permissions: [permission] },
                approvePermissions: { noPermissions: true }
            });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, body_id: 1337 }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/boardview/1337',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(status);

            if (status === 200) {
                expect(res.body.data.map((row) => row.id)).toEqual([application.id]);
            } else {
                expect(res.body.success).toEqual(false);
                expect(res.body).not.toHaveProperty('data');
            }
        });
    });
});
