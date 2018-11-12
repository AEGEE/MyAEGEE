const tk = require('timekeeper');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications cancellation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should succeed for current user within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
        expect(res.body.data.cancelled).toEqual(true);
    });

    test('should not succeed for current user if not within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id }, event);

        tk.travel(moment(event.application_period_starts).subtract(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed for other user when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.cancelled).toEqual(true);
    });

    test('should return 403 for other user when user does not have permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ applications: [] });

        tk.travel(moment(event.application_period_starts).add(5, 'minutes').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if the application is not found for other user', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/333/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed user_id', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/lalala/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if cancelled is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: 'lalala' }
        });


        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });
});
