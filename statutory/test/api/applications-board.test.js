const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications pax type/board comment', () => {
    let event;
    let application;

    beforeEach(async () => {
        mock.mockAll();
        await startServer();

        // Checking on agora and on delegate, for others - pretty much the same.
        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'year').toDate(),
            application_period_ends: moment().toDate(),
            board_approve_deadline: moment().add(1, 'year').toDate(),
        });

        application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should not succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when the permissions are okay', async () => {
        application = await application.update({ user_id: 1337 }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', board_comment: 'test', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual('delegate');
        expect(res.body.data.participant_order).toEqual(1);
        expect(res.body.data.board_comment).toEqual('test');
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });

        application = await application.update({ user_id: 1337 }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/1337/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed user_id', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/lalala/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if info is invalid', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'invalid', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant type is set, but participant order is not', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_order: 1 }
        });


        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant order is not a number', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 'invalid' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant order is negative', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: -1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant order is set, but participant type is not', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if there is already an application with the same pax type and order from this body', async () => {
        application = await application.update({
            participant_type: 'delegate',
            participant_order: 1
        }, { returning: true });

        const otherApplication = await generator.createApplication({
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + otherApplication.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed and update nothing when the body is empty', async () => {
        application = await application.update({
            participant_type: 'delegate',
            participant_order: 1
        }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual(application.participant_type);
        expect(res.body.data.board_comment).toEqual(application.board_comment);
    });

    test('should return 403 if the user is not within deadline and doesn\'t have global permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        event = await event.update({
            type: 'agora',
            application_period_starts: moment().subtract(5, 'year').toDate(),
            application_period_ends: moment().subtract(4, 'year').toDate(),
            board_approve_deadline: moment().subtract(3, 'year').toDate(),
            starts: moment().subtract(2, 'year').toDate(),
            ends: moment().subtract(1, 'year').toDate(),
        }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when unsetting the pax type/order', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should succeed if the limit is unlimited', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        await generator.createPaxLimit({
            body_id: regularUser.bodies[0].id,
            event_type: event.type,
            delegate: null
        });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should return 403 when using default limits and too much applications', async () => {
        // The body type is antenna, it cannot send observers.
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'observer', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 when using custom limits and too much applications', async () => {
        await generator.createPaxLimit({
            body_id: regularUser.bodies[0].id,
            event_type: event.type,
            delegate: 0
        });

        // The body type is antenna, it cannot send observers.
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 when the pax order is too big', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1337 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if body query returns net error', async () => {
        mock.mockAll({ body: { netError: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns bad response', async () => {
        mock.mockAll({ body: { badResponse: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: true });

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
