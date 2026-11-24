const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const Event = require('../../models/Event');

describe('Events status editing', () => {
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
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should disallow changing event status if user has no rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ status: 'published' });

        const res = await request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                status: 'draft'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.status).toEqual('published');
    });

    test('should return 404 if event is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/nonexistant/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                status: 'published'
            }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should disallow changing event status if status is undefined', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should disallow changing event status if status is invalid', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'not-existant' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.status).not.toEqual('not-existant');
    });

    test('should allow changing event status if everything is okay', async () => {
        const event = await generator.createEvent({ status: 'draft' });

        const res = await request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'published' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.status).toEqual('published');
    });

    test('should set publication_date if changed to published', async () => {
        const event = await generator.createEvent({ status: 'draft' });

        const res = await request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'published' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.publication_date).not.toBeNull();
    });

    test('should not set publication_date if changed to draft', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status: 'draft' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.publication_date).toBeNull();
    });

    describe('who may publish and unpublish an event', () => {
        test.each(['agora', 'epm', 'spm'])('should let the holder of global:manage_event:%s alone publish such an event and make it a draft again', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:' + type] } });
            const event = await generator.createEvent({ type, status: 'draft' });

            const published = await request({
                path: '/events/' + event.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'published' }
            });

            expect(published.statusCode).toEqual(200);
            expect(published.body).toEqual({ success: true, message: 'Event status was changed successfully.' });
            expect((await Event.findByPk(event.id)).status).toEqual('published');

            const unpublished = await request({
                path: '/events/' + event.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'draft' }
            });

            expect(unpublished.statusCode).toEqual(200);
            expect((await Event.findByPk(event.id)).status).toEqual('draft');
        });

        test.each([
            ['agora', ['global:manage_event:epm', 'global:manage_event:spm']],
            ['epm', ['global:manage_event:agora', 'global:manage_event:spm']],
            ['spm', ['global:manage_event:agora', 'global:manage_event:epm']],
            ['agora', ['global:manage_applications:agora', 'global:manage_incoming:agora', 'global:approve_members:agora']]
        ])('should refuse to make a published %s a draft for somebody with %j', async (type, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const event = await generator.createEvent({ type, status: 'published' });

            const res = await request({
                path: '/events/' + event.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'draft' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change status for events of this type.');
            expect((await Event.findByPk(event.id)).status).toEqual('published');
        });

        // The body is looked at before the permission.
        test('should answer 400 without a status, also to somebody without permissions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ status: 'published' });

            const res = await request({
                path: '/events/' + event.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: {}
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('New status is not set.');
        });
    });

    describe('the status', () => {
        test.each([null, '', 0, false])('should answer 400 for %p, which counts as no status', async (status) => {
            const event = await generator.createEvent({ status: 'published' });

            const res = await request({
                path: '/events/' + event.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('New status is not set.');
            expect((await Event.findByPk(event.id)).status).toEqual('published');
        });

        test.each(['PUBLISHED', 'deleted', 5, true, { status: 'draft' }])('should answer 422 for %p', async (status) => {
            const event = await generator.createEvent({ status: 'published' });

            const res = await request({
                path: '/events/' + event.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status }
            });

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body.errors)).toEqual(['status']);
            expect(res.body.errors.status).toContain('Event status should be one of these: "draft", "published".');
            expect((await Event.findByPk(event.id)).status).toEqual('published');
        });
    });

    describe('publication_date', () => {
        const setStatus = (event, status) => request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status }
        });

        test('should be the moment the event is published', async () => {
            const event = await generator.createEvent({ status: 'draft' });
            const now = new Date('2029-06-01T12:00:00.000Z');
            tk.freeze(now);

            const res = await setStatus(event, 'published');

            expect(res.statusCode).toEqual(200);
            expect((await Event.findByPk(event.id)).publication_date).toEqual(now);
        });

        test('should stay when the event is made a draft again', async () => {
            const event = await generator.createEvent({ status: 'draft' });
            const published = new Date('2029-06-01T12:00:00.000Z');
            tk.freeze(published);
            await setStatus(event, 'published');

            tk.freeze(new Date('2029-06-02T12:00:00.000Z'));
            const res = await setStatus(event, 'draft');

            expect(res.statusCode).toEqual(200);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).toEqual('draft');
            expect(eventFromDb.publication_date).toEqual(published);
        });

        test('should move when the event is published again after it was a draft', async () => {
            const event = await generator.createEvent({ status: 'draft' });
            tk.freeze(new Date('2029-06-01T12:00:00.000Z'));
            await setStatus(event, 'published');
            await setStatus(event, 'draft');

            const again = new Date('2029-06-03T12:00:00.000Z');
            tk.freeze(again);
            const res = await setStatus(event, 'published');

            expect(res.statusCode).toEqual(200);
            expect((await Event.findByPk(event.id)).publication_date).toEqual(again);
        });

        // BUG: asking to publish an event that is published already changes its publication
        // date. Expected: the date of the moment it became published stays.
        test('should move when a published event is published once more', async () => {
            const event = await generator.createEvent({ status: 'draft' });
            tk.freeze(new Date('2029-06-01T12:00:00.000Z'));
            await setStatus(event, 'published');

            const again = new Date('2029-06-03T12:00:00.000Z');
            tk.freeze(again);
            const res = await setStatus(event, 'published');

            expect(res.statusCode).toEqual(200);
            expect((await Event.findByPk(event.id)).publication_date).toEqual(again);
        });
    });
});
