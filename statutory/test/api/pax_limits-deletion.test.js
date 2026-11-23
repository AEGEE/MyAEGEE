const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const bodies = require('../assets/core-bodies.json').data;
const { PaxLimit } = require('../../models');

describe('Pax limits deletion', () => {
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

    test('should allow deleting custom limit', async () => {
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should not allow deleting limit when there\'s no limit', async () => {
        const res = await request({
            path: '/limits/agora/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the event type is invalid', async () => {
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            path: '/limits/invalid/' + bodies[0].id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the body_id is invalid', async () => {
        const res = await request({
            path: '/limits/agora/invalid',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    const remove = (type, bodyId) => request({
        path: '/limits/' + type + '/' + bodyId,
        method: 'DELETE',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    describe('who may remove a limit', () => {
        test.each(['agora', 'epm', 'spm'])('should let the holder of global:manage_event:%s alone remove a limit for such events', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:' + type] } });
            await generator.createPaxLimit({ body_id: 34, event_type: type });

            const res = await remove(type, 34);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'The limit for a body 34 was deleted, using default one now.' });
            expect(await PaxLimit.count()).toEqual(0);
        });

        test.each([
            ['agora', ['global:manage_event:epm', 'global:manage_event:spm']],
            ['epm', ['global:manage_event:agora', 'global:manage_event:spm']],
            ['spm', ['global:manage_event:agora', 'global:manage_event:epm']],
            ['agora', ['global:manage_applications:agora', 'global:approve_members:agora', 'global:manage_memberslist:agora']]
        ])('should refuse to remove a limit for %s for somebody with %j', async (type, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });
            await generator.createPaxLimit({ body_id: 34, event_type: type });

            const res = await remove(type, 34);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change limits.');
            expect(await PaxLimit.count()).toEqual(1);
        });
    });

    describe('what is removed', () => {
        test('should remove the limit of this body for this event type only, after which the default counts', async () => {
            await generator.createPaxLimit({ body_id: 34, event_type: 'agora', delegate: 9, envoy: 9, observer: 9, visitor: 9 });
            const otherType = await generator.createPaxLimit({ body_id: 34, event_type: 'epm' });
            const otherBody = await generator.createPaxLimit({ body_id: 9, event_type: 'agora' });

            const res = await remove('agora', 34);

            expect(res.statusCode).toEqual(200);
            expect((await PaxLimit.findAll({ order: [['id', 'ASC']] })).map((limit) => limit.id)).toEqual([otherType.id, otherBody.id]);

            const limit = await request({
                path: '/limits/agora/34',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            // An antenna, by default.
            expect(limit.body.data).toEqual({
                id: null,
                body_id: 34,
                event_type: 'agora',
                delegate: 3,
                envoy: 0,
                observer: 0,
                visitor: 30,
                default: true
            });
        });

        test('should answer 404 when the body only has a limit for another event type, and keep that one', async () => {
            const limit = await generator.createPaxLimit({ body_id: 34, event_type: 'epm' });

            const res = await remove('agora', 34);

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual('There\'s no limit for body with the ID 34.');
            expect((await PaxLimit.findAll()).map((l) => l.id)).toEqual([limit.id]);
        });

        test('should answer 404 the second time', async () => {
            await generator.createPaxLimit({ body_id: 34, event_type: 'agora' });

            expect((await remove('agora', 34)).statusCode).toEqual(200);
            expect((await remove('agora', 34)).statusCode).toEqual(404);
        });

        // The limit is removed whether or not core still knows the body.
        test('should remove the limit of a body that core does not know', async () => {
            mock.mockAll({ body: { notFound: true }, bodies: { empty: true } });
            await generator.createPaxLimit({ body_id: 1337, event_type: 'agora' });

            const res = await remove('agora', 1337);

            expect(res.statusCode).toEqual(200);
            expect(await PaxLimit.count()).toEqual(0);
        });
    });
});
