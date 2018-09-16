const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const Event = require('../../models/Event');

describe('Events status editing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should disallow changing event status if user has no rights', async () => {
        mock.mockAll({ core: { regularUser: true } });

        const event = await generator.createEvent();

        const res = await request({
            uri: '/event/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                status: 'published'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findOne({ where: { id: event.id } });
        expect(eventFromDb.status).not.toEqual('published');
    });

    test('should return 404 if event is not found', async () => {
        mock.mockAll({ core: { regularUser: true } });

        const res = await request({
            uri: '/event/nonexistant/status',
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
            uri: '/event/' + event.id + '/status',
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
            uri: '/event/' + event.id + '/status',
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
        const event = await generator.createEvent();

        const res = await request({
            uri: '/event/' + event.id + '/status',
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
});
