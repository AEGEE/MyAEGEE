const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Plenaries edition', () => {
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
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if plenary is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/1337',
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if plenary ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/NaN',
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.name).toEqual('test');
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { starts: null },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('starts');
    });
});
