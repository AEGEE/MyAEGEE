const { startServer, stopServer } = require('../../lib/server.js');
const { Event } = require('../../models');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid').data;


describe('Events organization management', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow adding organizer for event you cannot edit', async () => {
        const notMineEvent = await generator.createEvent({ organizers: [{ user_id: 1337 }] });
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/single/' + notMineEvent.id + '/organizers/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                user_id: user.id,
                comment: 'Good guy'
            }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow adding organizer if the user is already an organizer', async () => {
        const eventImOrganizing = await generator.createEvent({ organizers: [{ user_id: user.id }] });

        const res = await request({
            uri: '/single/' + eventImOrganizing.id + '/organizers/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                user_id: user.id,
                comment: 'Not that good guy'
            }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow adding organizer for event you can edit', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: 1337 }] });

        const res = await request({
            uri: '/single/' + event.id + '/organizers/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                user_id: user.id,
                comment: 'Good guy'
            }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const newEvent = await Event.findByPk(event.id);
        expect(newEvent.organizers.map(org => org.user_id)).toContain(user.id);
        expect(newEvent.organizers.map(org => org.comment)).toContain('Good guy');
    });

    it('should disallow editing organizer for event you cannot edit', async () => {
        const notMineEvent = await generator.createEvent({ organizers: [{ user_id: 1337 }] });
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/single/' + notMineEvent.id + '/organizers/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                comment: 'Not that good guy'
            }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow editing organizer if userId is not a number', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: user.id }] });
        const res = await request({
            uri: '/single/' + event.id + '/organizers/lalala',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                comment: 'Not that good guy'
            }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow editing organizer if the user is not an organizer', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: user.id }] });
        const res = await request({
            uri: '/single/' + event.id + '/organizers/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                comment: 'Not that good guy'
            }
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow editing organizer for event you can edit', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: user.id }] });
        const res = await request({
            uri: '/single/' + event.id + '/organizers/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                comment: 'Not that good guy'
            }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const newEvent = await Event.findByPk(event.id);
        expect(newEvent.organizers.map(org => org.user_id)).toContain(user.id);
        expect(newEvent.organizers.map(org => org.comment)).toContain('Not that good guy');
    });

    it('should disallow deleting organizer for event you cannot edit', async () => {
        const notMineEvent = await generator.createEvent({ organizers: [{ user_id: 1337 }] });
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/single/' + notMineEvent.id + '/organizers/' + user.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow deleting organizer if userId is not a number', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: user.id }] });
        const res = await request({
            uri: '/single/' + event.id + '/organizers/lalala',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow deleting organizer if the user is not an organizer', async () => {
        const event = await generator.createEvent({ organizers: [{ user_id: user.id }] });
        const res = await request({
            uri: '/single/' + event.id + '/organizers/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow deleting organizer if the user is only organizer', async () => {
        const myEvent = await generator.createEvent({ organizers: [{ user_id: user.id }] });
        const res = await request({
            uri: '/single/' + myEvent.id + '/organizers/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow deleting organizer for event you can edit', async () => {
        const myEvent = await generator.createEvent({ organizers: [{ user_id: user.id }, { user_id: 1337 }] });

        const res = await request({
            uri: '/single/' + myEvent.id + '/organizers/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const newEvent = await Event.findByPk(myEvent.id);
        expect(newEvent.organizers.map(org => org.user_id)).not.toContain(1337);
    });
});
