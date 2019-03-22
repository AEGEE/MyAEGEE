const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Plenaries creation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if starts is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({ starts: null });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('starts');
    });

    test('should fail if ends is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({ ends: null });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if start is earlier than ends', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().subtract(1, 'week')
        });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
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
        const plenary = generator.generatePlenary({});

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({});

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });
});
