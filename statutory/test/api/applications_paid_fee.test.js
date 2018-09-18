const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid-regular-user').data;

describe('Applications paid fee', () => {
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

        const event = await generator.createEvent();
        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
        expect(res.body.data.paid_fee).toEqual(true);
    });

    test('should succeed for other user when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id + '/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(application.user_id);
        expect(res.body.data.paid_fee).toEqual(true);
    });

    test('should return 403 for other user when user does not have permissions', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id + '/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found for current user', async () => {
        mock.mockAll({ core: { regularUser: true } })

        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if the application is not found for other user', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/333/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed user_id', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/lalala/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: true }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if paid_fee is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.user_id + '/paid_fee',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { paid_fee: 'lalala' }
        });


        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });
});
