const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Positions edition', () => {
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
            uri: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: { places: 3 },
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
            uri: '/events/' + event.id + '/positions/1337',
            method: 'PUT',
            body: { places: 3 },
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
            uri: '/events/' + event.id + '/positions/NaN',
            method: 'PUT',
            body: { places: 3 },
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
            uri: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: { places: 3 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.places).toEqual(3);
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: { places: false },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('places');
    });

    test('should remove extra fields', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate() // status = open
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: {
                id: position.id + 1,
                status: 'closed'
            },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(position.id);
        expect(res.body.data.status).toEqual('open');
    });
});
