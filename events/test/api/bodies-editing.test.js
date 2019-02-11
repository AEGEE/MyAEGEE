const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');

describe('Event bodies editing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow adding a body for event you cannot edit', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }] });
        const res = await request({
            uri: '/single/' + event.id + '/bodies',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: { body_id: 333 }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow adding organizing body if the user is already an organizer', async () => {
        const event = await generator.createEvent({
            organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }],
            organizing_bodies: [{ body_id: 333 }]
        });
        const res = await request({
            uri: '/single/' + event.id + '/bodies',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: { body_id: 333 }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow adding organizing body for event you can edit', async () => {
        const event = await generator.createEvent({
            organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }],
            organizing_bodies: [{ body_id: 333 }]
        });
        const res = await request({
            uri: '/single/' + event.id + '/bodies',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: { body_id: 444 }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const newEvent = await Event.findById(event.id);
        expect(newEvent.organizing_bodies.map(org => org.body_id)).toContain(444);
    });

    it('should disallow deleting organizing body for event you cannot edit', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }] });
        const res = await request({
            uri: '/single/' + event.id + '/bodies/' + event.organizing_bodies[0].body_id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'DELETE'
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow deleting organizing body if bodyId is not a number', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }] });
        const res = await request({
            uri: '/single/' + event.id + '/bodies/nan',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'DELETE'
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow deleting organizing body if local is not an organizing local', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }] });
        const res = await request({
            uri: '/single/' + event.id + '/bodies/1337',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'DELETE'
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow deleting organizing body if body is only organizing body', async () => {
        const event = await generator.createEvent({
            organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }],
            organizing_bodies: [{ body_id: 333 }]
        });
        const res = await request({
            uri: '/single/' + event.id + '/bodies/333',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'DELETE'
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    it('should allow deleting organizer for event you can edit', async () => {
        const event = await generator.createEvent({
            organizers: [{ user_id: 333, first_name: 'test', last_name: 'test' }],
            organizing_bodies: [{ body_id: 333 }, { body_id: 444 }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/bodies/333',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'DELETE'
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const newEvent = await Event.findById(event.id);
        expect(newEvent.organizing_bodies.map(org => org.body_id)).not.toContain(333);
    });
});
