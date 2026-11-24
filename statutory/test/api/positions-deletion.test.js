const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position } = require('../../models');

describe('Positions deletion', () => {
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
        const position = await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id,
            method: 'DELETE',
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
            path: '/events/' + event.id + '/positions/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if positions ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/NaN',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    describe('who may delete a position and what is left of it', () => {
        const MANAGE = 'global:manage_candidates:agora';
        let event;
        let position;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            position = await generator.createPosition({}, event);
        });

        const remove = (targetEvent = event, targetPosition = position) => request({
            path: '/events/' + targetEvent.id + '/positions/' + targetPosition.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('lets a holder of global:manage_candidates:agora alone delete a position, which is kept but no longer listed', async () => {
            const kept = await generator.createPosition({}, event);

            const res = await remove();

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'The position was deleted.' });

            const positions = await Position.findAll({ order: [['id', 'ASC']] });
            expect(positions.map((p) => [p.id, p.deleted])).toEqual([[position.id, true], [kept.id, false]]);

            const list = await request({
                path: '/events/' + event.id + '/positions/',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });
            expect(list.body.data.map((p) => p.id)).toEqual([kept.id]);
        });

        test('answers 404 for a position that is deleted already', async () => {
            await remove();

            const res = await remove();

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Position is not found.' });
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

            const res = await remove();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage positions.' });
            expect((await Position.findByPk(position.id)).deleted).toEqual(false);
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and deletes nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const otherPosition = await generator.createPosition({}, otherEvent);

            const res = await remove(otherEvent, otherPosition);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect((await Position.findByPk(otherPosition.id)).deleted).toEqual(false);
        });
    });
});
