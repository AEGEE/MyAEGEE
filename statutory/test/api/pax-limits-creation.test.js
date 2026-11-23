const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { PaxLimit } = require('../../models');

describe('Pax limits creation/editing', () => {
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

    test('should update the limit if exists', async () => {
        const limit = generator.generatePaxLimit();
        const res = await request({
            path: '/limits/agora',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should update the limit if not exists', async () => {
        await generator.createPaxLimit({ body_id: 1, event_type: 'agora' });
        const limit = generator.generatePaxLimit({ body_id: 1, event_type: 'agora' });

        const res = await request({
            path: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should allow creating the limit if the limit exists for different event type', async () => {
        await generator.createPaxLimit({ body_id: 1, event_type: 'epm' });
        const limit = generator.generatePaxLimit({ body_id: 1, event_type: 'agora' });

        const res = await request({
            path: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should return 400 if the event type is invalid', async () => {
        const limit = generator.generatePaxLimit();

        const res = await request({
            path: '/limits/invalid/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const limit = generator.generatePaxLimit();

        const res = await request({
            path: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 422 if some of the values is not an integer', async () => {
        const limit = generator.generatePaxLimit({ envoy: false });

        const res = await request({
            path: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('envoy');
    });

    test('should return 422 if some of the values is negative', async () => {
        const limit = generator.generatePaxLimit({ envoy: -1 });

        const res = await request({
            path: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('envoy');
    });

    test('should allow saving if some of the values are null', async () => {
        const limit = generator.generatePaxLimit({ envoy: null });

        const res = await request({
            path: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.envoy).toEqual(null);
    });

    test.each([
        ['is missing', undefined],
        ['is null', null],
        ['is not a number', 'abc'],
        ['is not a whole number', 1.5],
        ['is an object', { id: 1 }]
    ])('should return 422 if body_id %s', async (description, bodyId) => {
        const limit = generator.generatePaxLimit({ event_type: 'agora' });
        limit.body_id = bodyId;

        const res = await request({
            path: '/limits/agora',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: limit
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('body_id');
        expect(await PaxLimit.count()).toEqual(0);
    });

    const send = (type, body) => request({
        path: '/limits/' + type,
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    describe('who may store a limit', () => {
        test.each(['agora', 'epm', 'spm'])('should let the holder of global:manage_event:%s alone store a limit for such events', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:' + type] } });

            const res = await send(type, { body_id: 34, delegate: 2, envoy: 1, observer: 0, visitor: null });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                body_id: 34,
                event_type: type,
                delegate: 2,
                envoy: 1,
                observer: 0,
                visitor: null,
                default: false
            });

            const limits = await PaxLimit.findAll({ raw: true });
            expect(limits.length).toEqual(1);
            expect(limits[0]).toMatchObject({
                id: res.body.data.id,
                body_id: 34,
                event_type: type,
                delegate: 2,
                envoy: 1,
                observer: 0,
                visitor: null
            });
        });

        test.each([
            ['agora', ['global:manage_event:epm', 'global:manage_event:spm']],
            ['epm', ['global:manage_event:agora', 'global:manage_event:spm']],
            ['spm', ['global:manage_event:agora', 'global:manage_event:epm']],
            ['agora', ['global:manage_applications:agora', 'global:approve_members:agora', 'global:manage_memberslist:agora']]
        ])('should refuse a limit for %s from somebody with %j', async (type, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await send(type, { body_id: 34, delegate: 2, envoy: 1, observer: 0, visitor: null });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change limits.');
            expect(res.body).not.toHaveProperty('data');
            expect(await PaxLimit.count()).toEqual(0);
        });

        test('should not let the limit of a body be replaced by somebody who manages the events of another type', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:epm'] } });
            const limit = await generator.createPaxLimit({ body_id: 34, event_type: 'agora', delegate: 3 });

            const res = await send('agora', { body_id: 34, delegate: 99 });

            expect(res.statusCode).toEqual(403);
            expect((await PaxLimit.findByPk(limit.id)).delegate).toEqual(3);
        });
    });

    describe('what is stored', () => {
        test('should replace the limit the body has for this event type, and leave the other limits', async () => {
            const limit = await generator.createPaxLimit({ body_id: 34, event_type: 'agora', delegate: 3, envoy: 3, observer: 3, visitor: 3 });
            const otherType = await generator.createPaxLimit({ body_id: 34, event_type: 'epm', delegate: 4, envoy: 4, observer: 4, visitor: 4 });
            const otherBody = await generator.createPaxLimit({ body_id: 35, event_type: 'agora', delegate: 5, envoy: 5, observer: 5, visitor: 5 });

            const res = await send('agora', { body_id: 34, delegate: 0, envoy: null, observer: 1, visitor: 2 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(limit.id);
            expect(await PaxLimit.count()).toEqual(3);
            expect(await PaxLimit.findByPk(limit.id, { raw: true })).toMatchObject({ delegate: 0, envoy: null, observer: 1, visitor: 2 });
            expect(await PaxLimit.findByPk(otherType.id, { raw: true })).toMatchObject({ delegate: 4, envoy: 4, observer: 4, visitor: 4 });
            expect(await PaxLimit.findByPk(otherBody.id, { raw: true })).toMatchObject({ delegate: 5, envoy: 5, observer: 5, visitor: 5 });
        });

        test('should store no limit (null) for a participant type that a new limit leaves out', async () => {
            const res = await send('agora', { body_id: 34, delegate: 2 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ delegate: 2, envoy: null, observer: null, visitor: null });
            expect(await PaxLimit.findOne({ raw: true })).toMatchObject({ delegate: 2, envoy: null, observer: null, visitor: null });
        });

        test('should keep the participant types that a change of a stored limit leaves out', async () => {
            const limit = await generator.createPaxLimit({ body_id: 34, event_type: 'agora', delegate: 3, envoy: 3, observer: 3, visitor: 3 });

            const res = await send('agora', { body_id: 34, envoy: 7 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ delegate: 3, envoy: 7, observer: 3, visitor: 3 });
            expect(await PaxLimit.findByPk(limit.id, { raw: true })).toMatchObject({ delegate: 3, envoy: 7, observer: 3, visitor: 3 });
        });

        test('should take the event type from the path, not from the body', async () => {
            const res = await send('agora', { body_id: 34, delegate: 2, event_type: 'epm' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.event_type).toEqual('agora');
            expect((await PaxLimit.findAll()).map((limit) => limit.event_type)).toEqual(['agora']);
        });

        test('should give a new limit its own id, not the one in the body', async () => {
            const res = await send('agora', { id: 424242, body_id: 34, delegate: 2 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).not.toEqual(424242);
            expect(await PaxLimit.findByPk(424242)).toEqual(null);
        });

        test('should not change the id of a stored limit', async () => {
            const limit = await generator.createPaxLimit({ body_id: 34, event_type: 'agora' });

            const res = await send('agora', { id: 424242, body_id: 34, delegate: 2 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(limit.id);
            expect((await PaxLimit.findAll()).map((l) => l.id)).toEqual([limit.id]);
        });

        test('should accept 0, which is nobody', async () => {
            const res = await send('agora', { body_id: 34, delegate: 0, envoy: 0, observer: 0, visitor: 0 });

            expect(res.statusCode).toEqual(200);
            expect(await PaxLimit.findOne({ raw: true })).toMatchObject({ delegate: 0, envoy: 0, observer: 0, visitor: 0 });
        });

        test.each([
            ['a number as text', '5'],
            ['a number that is not whole', 1.5],
            ['a list', [5]],
            ['true', true]
        ])('should refuse %s as a limit and store nothing', async (description, value) => {
            for (const field of ['delegate', 'envoy', 'observer', 'visitor']) {
                const res = await send('agora', { body_id: 34, delegate: 1, envoy: 1, observer: 1, visitor: 1, [field]: value });

                expect(res.statusCode).toEqual(422);
                expect(Object.keys(res.body.errors)).toEqual([field]);
            }

            expect(await PaxLimit.count()).toEqual(0);
        });

        test('should refuse a wrong value for a stored limit and leave it as it was', async () => {
            const limit = await generator.createPaxLimit({ body_id: 34, event_type: 'agora', delegate: 3, envoy: 3, observer: 3, visitor: 3 });

            const res = await send('agora', { body_id: 34, delegate: 9, envoy: -1 });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('envoy');
            expect(await PaxLimit.findByPk(limit.id, { raw: true })).toMatchObject({ delegate: 3, envoy: 3, observer: 3, visitor: 3 });
        });
    });
});
