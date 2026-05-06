const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const Event = require('../../models/Event');
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
});
