const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

describe('Applications departion', () => {
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
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should not succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/me/departed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { departed: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed for other user when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ confirmed: true, registered: true }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/departed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { departed: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.confirmed).toEqual(true);
    });

    test('should fail if application is not marked as registered', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ confirmed: true, registered: false }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/departed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { departed: true }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('departed');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({ confirmed: true, incoming: true, attended: true }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/departed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { departed: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/applications/333/departed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { departed: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if departed is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ confirmed: true, incoming: true, attended: true }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/departed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { departed: 'lalala' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('who may set it', () => {
        test.each([
            ['global:manage_juridical:agora', 200],
            ['global:manage_applications:agora', 200],
            ['global:manage_incoming:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:manage_juridical:epm', 403],
            ['global:manage_applications:epm', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted', confirmed: true, registered: true }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/departed',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { departed: true }
            });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            // Nothing is stored when the request is refused.
            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.departed).toEqual(status === 200);
        });
    });
});
