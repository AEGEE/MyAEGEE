const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position } = require('../../models');

describe('Positions status update', () => {
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
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate() // status = open
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if position is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/positions/1337/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if positions ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/positions/NaN/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate() // status = open
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.status).toEqual('closed');
    });

    test('should not update anything if body is empty', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate() // status = open
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/status',
            method: 'PUT',
            body: {},
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.status).toEqual('open');
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate() // status = open
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/status',
            method: 'PUT',
            body: { status: false },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');
    });

    test('should not affect extra fields', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(), // status = open
            places: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/status',
            method: 'PUT',
            body: {
                places: 5
            },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.places).toEqual(1);
    });

    describe('who may open and close a position', () => {
        const MANAGE = 'global:manage_candidates:agora';
        let event;
        let position;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate() // status = open
            }, event);
        });

        const setStatus = (status, targetEvent = event, positionId = position.id) => request({
            path: '/events/' + targetEvent.id + '/positions/' + positionId + '/status',
            method: 'PUT',
            body: { status },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('lets a holder of global:manage_candidates:agora alone close a position', async () => {
            const res = await setStatus('closed');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('closed');
            expect((await Position.findByPk(position.id)).status).toEqual('closed');
        });

        test('lets them open a position again after its period', async () => {
            const pastPosition = await generator.createPosition({
                starts: moment().subtract(2, 'weeks').toDate(),
                ends: moment().subtract(1, 'week').toDate() // status = closed
            }, event);

            const res = await setStatus('open', event, pastPosition.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('open');
            expect(res.body.data.can_apply).toEqual(false);
            expect((await Position.findByPk(pastPosition.id)).status).toEqual('open');
        });

        test('refuses the permission for another event type and the other permissions for an Agora', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:manage_candidates:epm',
                        'global:manage_event:agora',
                        'global:manage_applications:agora',
                        'global:manage_plenaries:agora',
                        'global:manage_question_lines:agora'
                    ]
                }
            });

            const res = await setStatus('closed');

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage positions.' });
            expect((await Position.findByPk(position.id)).status).toEqual('open');
        });

        test('answers 422 for a status that does not exist and changes nothing', async () => {
            const res = await setStatus('paused');

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { status: ['Position status can be one of these: "open", "closed".'] }
            });
            expect((await Position.findByPk(position.id)).status).toEqual('open');
        });

        test('answers 400 for the position id Infinity, as for any value that is not written in digits', async () => {
            const res = await setStatus('closed', event, 'Infinity');

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'The position ID is invalid.' });
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and changes nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const otherPosition = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate() // status = open
            }, otherEvent);

            const res = await setStatus('closed', otherEvent, otherPosition.id);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect((await Position.findByPk(otherPosition.id)).status).toEqual('open');
        });
    });
});
