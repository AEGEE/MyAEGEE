const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const user = require('../assets/oms-core-valid').data;

describe('Events editing', () => {
    let event;

    beforeEach(async () => {
        event = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }] });
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow event editing if the user doesn\'t have rights to do it', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const notMineEvent = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: 333 }] });

        const res = await request({
            uri: '/single/' + notMineEvent.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should update an event on a sane /single/<eventid> PUT', async () => {
        const res = await request({
            uri: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
            }
        });

        expect(res.statusCode).toEqual(200);
    });

    it('should store the changes on update after a sane /single/<eventid> PUT', async () => {
        await request({
            uri: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
            }
        });

        const res = await request({
            uri: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.body.data.description).toEqual('some new description');
    });

    it('should ignore superflous fields on overly detailed /single/<eventid> PUT', async () => {
        await request({
            uri: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                status: 'published',
            }
        });

        const res = await request({
            uri: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).not.toEqual('published');
    });

    it('should return a validation error on malformed /single/<eventid> PUT', async () => {
        const res = await request({
            uri: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                ends: 'sometime',
            }
        });

        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
    });

    it('should not update the organizers list with /single/<eventid> PUT', async () => {
        await request({
            uri: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                organizers: [
                    {
                        first_name: 'new',
                        last_name: 'new',
                        user_id: 1337
                    },
                ],
            }
        });

        const newEvent = await Event.findById(event.id);
        expect(newEvent.organizers.map(org => org.user_id)).not.toContain(1337);
    });

    it('should disallow event deleting if the user doesn\'t have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/single/' + event.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should hide an event from / GET but keep it for /single GET after /single DELETE', async () => {
        await request({
            uri: '/single/' + event.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const res = await request({
            uri: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

    // Delete one even
        expect(res.statusCode).toEqual(200);

        expect(res.body.data.id).toEqual(event.id);
        expect(res.body.data.deleted).toEqual(true);
    });
});
