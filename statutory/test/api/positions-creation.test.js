const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Positions creation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if deadline is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ ends: null });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if positions amount is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ places: 'string' });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('places');
    });

    test('should fail if positions amount is less than 1', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ places: -1 });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('places');
    });

    test('should fail if name is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ name: null });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if start is earlier than ends', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().subtract(1, 'week')
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({});

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({});

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(position.name);
        expect(res.body.data.description).toEqual(position.description);
        expect(res.body.data.places).toEqual(position.places);
        expect(res.body.data.status).toEqual('open');
    });

    test('should plan candidature opening for the future', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(position.name);
        expect(res.body.data.description).toEqual(position.description);
        expect(res.body.data.places).toEqual(position.places);
        expect(res.body.data.status).toEqual('closed');
    });

    test('should open candidates if the application period is opened already', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(position.name);
        expect(res.body.data.description).toEqual(position.description);
        expect(res.body.data.places).toEqual(position.places);
        expect(res.body.data.status).toEqual('open');
    });
});
