const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');
const regularUser = require('../assets/core-valid.json').data;

describe('Applications displaying', () => {
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

    test('should succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ applications: [] });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/me',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
    });

    test('should succeed for board members', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(1337);
    });

    test('should return editable bodies for the application owner instead of the logged-in user', async () => {
        // A body as core sends it with a member, of which only the id, name, type and code are passed on.
        const applicantBody = {
            ...regularUser.bodies[0],
            id: 777,
            name: 'AEGEE-Test',
            type: 'antenna',
            code: 'TST'
        };
        const applicantUser = {
            ...regularUser,
            id: 1337,
            primary_body_id: applicantBody.id,
            bodies: [applicantBody]
        };

        mock.mockAll({
            member: { user: applicantUser }
        });

        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({
            user_id: applicantUser.id,
            body_id: regularUser.bodies[0].id
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.editable_bodies).toEqual([{ id: 777, name: 'AEGEE-Test', type: 'antenna', code: 'TST' }]);
        expect(Object.keys(res.body.data.editable_bodies[0]).sort()).toEqual(['code', 'id', 'name', 'type']);
    });

    test('should succeed for those who has permissions to see applications', async () => {
        const userId = 1337;
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: userId }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(userId);
    });

    test('should find application by statutory_id', async () => {
        const userId = 1337;
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: userId }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.statutory_id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.statutory_id).toEqual(application.statutory_id);
    });

    test('should return the error for those who does not have permissions to see applications', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });
        // A body the user is not a board member of. The approve permissions mock
        // still grants board rights for one body, which a random body_id can hit.
        const application = await generator.createApplication({ user_id: 1337, body_id: 1337 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return the notification email for incoming managers', async () => {
        mock.mockAll({ mainPermissions: { incomingPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: 1337,
            status: 'accepted'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.notification_email).toEqual('admin@example.com');
    });

    test('should succeed for incoming managers if the notification email is not available', async () => {
        mock.mockAll({
            mainPermissions: { incomingPermissions: true },
            mails: { unsuccessfulResponse: true }
        });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: 1337,
            status: 'accepted'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data).not.toHaveProperty('notification_email');
    });

    test('should return 404 if application is not found', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/applications/333',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if application ID is not an integer', async () => {
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({}, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '.0',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('who may see somebody else\'s application', () => {
        test.each([
            ['global:manage_applications:agora', 200],
            ['global:manage_incoming:agora', 200],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:apply:agora', 403],
            ['global:manage_applications:epm', 403],
            ['global:manage_incoming:epm', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            // Of a body the user is not a board member of.
            const application = await generator.createApplication({ user_id: 2, body_id: 1337, status: 'accepted' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            if (status === 200) {
                expect(res.body.data.id).toEqual(application.id);
            } else {
                expect(res.body).not.toHaveProperty('data');
            }
        });

        // BUG: those who approve the members of all bodies read this application, board comment
        // included, in the board view of its body and may set its participant type, but the
        // application itself is refused: only the board of the applicant's body is let through.
        // Expected: 200 with the whole application.
        test('global:approve_members:agora alone answers 403 on an Agora', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_members:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, body_id: 1337 }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).not.toHaveProperty('data');

            const boardview = await request({
                path: '/events/' + event.id + '/applications/boardview/1337',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(boardview.statusCode).toEqual(200);
            expect(boardview.body.data[0].board_comment).toEqual(application.board_comment);
        });
    });

    // Those who only hold manage_incoming see the applications of their own list, the
    // accepted ones that are not cancelled, with the fields of that list.
    describe('for the local organisers', () => {
        let event;

        const incomingFields = [...constants.ALLOWED_INCOMING_FIELDS, 'notification_email', 'editable_bodies', 'permissions'];

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_incoming:agora'] } });

            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const display = (application) => request({
            path: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('should display an accepted application with the fields of their list', async () => {
            const application = await generator.createApplication({ user_id: 2, body_id: 1337, status: 'accepted' }, event);

            tk.freeze(moment(event.participants_list_publish_deadline).toDate());

            const res = await display(application);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(Object.keys(res.body.data).sort()).toEqual([...incomingFields].sort());
            expect(res.body.data.visa_passport_number).toEqual(application.visa_passport_number);
            expect(typeof res.body.data.notification_email).toEqual('string');

            for (const field of ['board_comment', 'answers', 'nationality', 'gender', 'status', 'cancelled']) {
                expect(res.body.data).not.toHaveProperty(field);
            }
        });

        test('should tell what they may do with the application', async () => {
            const application = await generator.createApplication({ user_id: 2, body_id: 1337, status: 'accepted' }, event);

            const res = await display(application);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.editable_bodies).toEqual([]);
            // Not the whole application: the key is left out when the user is not in a board.
            expect(res.body.data.permissions.see_application).toBeFalsy();
            expect(res.body.data.permissions).toMatchObject({
                see_application_incoming: true,
                edit_application: false,
                set_application_cancelled: false,
                set_application_confirmed: true,
                set_application_incoming: true,
                set_application_attended: true,
                set_application_registered: false,
                set_application_departed: false,
                set_application_is_on_memberslist: false,
                change_status: false
            });
        });

        // BUG: before the event reveals the statuses the answer gets "status": "pending", for an
        // application that is only displayed because it is accepted. The field is not part of
        // the organisers' list. Expected: no status, as from the participants list deadline on.
        test('should add the status "pending" before the participants list deadline', async () => {
            const application = await generator.createApplication({ user_id: 2, body_id: 1337, status: 'accepted' }, event);

            tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'ms').toDate());

            const res = await display(application);

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body.data).sort()).toEqual([...incomingFields, 'status'].sort());
            expect(res.body.data.status).toEqual('pending');
        });

        test.each([
            ['pending', { status: 'pending' }],
            ['rejected', { status: 'rejected' }],
            ['on the waiting list', { status: 'waiting_list' }],
            ['accepted but cancelled', { status: 'accepted', cancelled: true }]
        ])('should return 404 for an application that is %s', async (description, fields) => {
            const application = await generator.createApplication({ user_id: 2, body_id: 1337, ...fields }, event);

            const res = await display(application);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
            expect(res.body).not.toHaveProperty('data');
        });

        test('should display their own application in full, whatever its status', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, body_id: 1337, status: 'pending' }, event);

            const res = await display(application);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.data.nationality).toEqual(application.nationality);
            expect(res.body.data.answers).toEqual(application.answers);
        });
    });
});
