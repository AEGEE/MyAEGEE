const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

describe('Events status change', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should include the event that can be changed in approvable events', async () => {
        const event = await generator.createEvent({
            status: 'draft'
        });

        const res = await request({
            uri: '/mine/approvable',
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should not include the event that cannot be changed in approvable events', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        await generator.createEvent({
            status: 'draft'
        });

        const res = await request({
            uri: '/mine/approvable',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(0);
    });

    describe('draft -> submitted', () => {
        it('should work for LOs', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'draft',
                organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).toEqual('submitted');
        });

        it('should work for those with permissions', async () => {
            const event = await generator.createEvent({
                status: 'draft',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).toEqual('submitted');
        });

        it('should not work otherwise', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'draft',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('submitted');
        });
    });

    describe('draft -> published', () => {
        it('should not work whatsoever', async () => {
            const event = await generator.createEvent({
                status: 'draft',
                organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'published' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('published');
        });
    });

    describe('submitted -> published', () => {
        it('should not work for LOs', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'submitted',
                organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'published' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('published');
        });

        it('should work for those with permissions', async () => {
            const event = await generator.createEvent({
                status: 'submitted',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'published' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).toEqual('published');
        });

        it('should not work otherwise', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'submitted',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'published' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('published');
        });
    });

    describe('submitted -> draft', () => {
        it('should not work for LOs', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'submitted',
                organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'draft' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('draft');
        });

        it('should work for those with permissions', async () => {
            const event = await generator.createEvent({
                status: 'submitted',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'draft' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).toEqual('draft');
        });

        it('should not work otherwise', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'submitted',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'draft' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('draft');
        });
    });

    describe('published -> submitted', () => {
        it('should not work for LOs', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'published',
                organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('submitted');
        });

        it('should work for those with permissions', async () => {
            const event = await generator.createEvent({
                status: 'published',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).toEqual('submitted');
        });

        it('should not work otherwise', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                status: 'published',
                organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('submitted');
        });
    });

    describe('published -> draft', () => {
        it('should not work whatsoever', async () => {
            const event = await generator.createEvent({
                status: 'published',
                organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }]
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'draft' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.status).not.toEqual('draft');
        });
    });

    describe('setting approval fields', () => {
        it('should not allow changing status from draft if budget is null', async () => {
            const event = await generator.createEvent({
                status: 'draft',
                budget: null
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('is_budget_set');
        });

        it('should not allow changing status from draft if budget is empty', async () => {
            const event = await generator.createEvent({
                status: 'draft',
                budget: '\t\t\t   \t \t'
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('is_budget_set');
        });

        it('should not allow changing status from draft if programme is null', async () => {
            const event = await generator.createEvent({
                status: 'draft',
                programme: null
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('is_programme_set');
        });

        it('should not allow changing status from draft if programme is empty', async () => {
            const event = await generator.createEvent({
                status: 'draft',
                programme: '\t\t\t   \t \t'
            });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('is_programme_set');
        });
    });

    describe('if mailer fails', () => {
        it('should return 500 if mailer returns net error', async () => {
            mock.mockAll({ mailer: { netError: true } });

            const event = await generator.createEvent({ status: 'draft' });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
        });

        it('should return 500 if mailer returns bad response', async () => {
            mock.mockAll({ mailer: { badResponse: true } });

            const event = await generator.createEvent({ status: 'draft' });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
        });

        it('should return 500 if mailer returns unsuccessful response', async () => {
            mock.mockAll({ mailer: { unsuccessfulResponse: true } });

            const event = await generator.createEvent({ status: 'draft' });

            const res = await request({
                uri: '/single/' + event.id + '/status',
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'PUT',
                body: { status: 'submitted' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
        });
    });
});
