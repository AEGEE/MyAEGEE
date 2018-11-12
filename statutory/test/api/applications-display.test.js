const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications displaying', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ applications: [] });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/me',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(regularUser.id);
    });

    test('should succeed for those who has permissions to see applications', async () => {
        const userId = Math.floor(Math.random() * 100 * 50); // from 50 to 150
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: userId }, event);


        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(userId);
    });

    test('should return the error for those who does not have permissions to see applications', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const userId = Math.floor(Math.random() * 100 * 50); // from 50 to 150
        const event = await generator.createEvent({ applications: [] });
        const application = await generator.createApplication({ user_id: userId }, event);


        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if ID is malformed', async () => {
        const event = await generator.createEvent();

        const res = await request({
            uri: '/events/' + event.id + '/applications/malformed',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if application is not found', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/333',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
