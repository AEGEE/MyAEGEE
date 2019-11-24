const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications confirmation', () => {
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
            uri: '/events/' + event.id + '/applications/me/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed for other user when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.confirmed).toEqual(true);
    });

    test('should fail if application is cancelled', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ cancelled: true }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: true }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('confirmed');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/333/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if confirmed is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: 'lalala' }
        });


        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 on unsetting confirmed if attended is true', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ confirmed: true, attended: true }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { confirmed: false }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });
});
