const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;
const { Application } = require('../../models');

describe('Applications pax type/board comment for a body', () => {
    let event;

    beforeEach(async () => {
        mock.mockAll();
        await startServer();

        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'year').toDate(),
            application_period_ends: moment().toDate(),
            board_approve_deadline: moment().add(1, 'year').toDate(),
        });
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should succeed when the permissions are okay', async () => {
        const applications = [
            await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event),
            await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event),
            await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event)
        ];

        const extraApplication = await generator.createApplication({ user_id: 13, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        for (const index in applications) {
            const application = applications[index];
            const entry = body[index];

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.user_id).toEqual(entry.user_id);
            expect(applicationFromDb.participant_type).toEqual(entry.participant_type);
            expect(applicationFromDb.participant_order).toEqual(entry.participant_order);
        }

        const extraApplicationFromDb = await Application.findByPk(extraApplication.id);
        expect(extraApplicationFromDb.participant_type).toEqual(null);
        expect(extraApplicationFromDb.participant_order).toEqual(null);
    });

    test('should set the board comment if it is provided', async () => {
        const application = await generator.createApplication({
            user_id: 10,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1, board_comment: 'Good guy.' },
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.board_comment).toEqual(body[0].board_comment);
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 if one of the applications is not found', async () => {
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed body_id', async () => {
        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/lalala',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if body is not an array', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries is not an array', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [false]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries does not have participant orger', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'delegate', user_id: 1, board_comment: 'test' }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries does not have participant type', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_order: 1, user_id: 1, board_comment: 'test' }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries does not have user ID', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'delegate', participant_order: 1, board_comment: 'test' }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries has user ID as not string', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'delegate', participant_order: 1, board_comment: 'test', user_id: false }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if info is invalid', async () => {
        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'invalid', participant_order: 1, user_id: 10 }]
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns net error', async () => {
        mock.mockAll({ body: { netError: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns bad response', async () => {
        mock.mockAll({ body: { badResponse: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            uri: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
