const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock-core-registry');

describe('API requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should fail if X-Auth-Token is not specified', async () => {
        const res = await request({
            uri: '/',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns net error while fetching user', async () => {
        mock.mockAll({ core: { netError: true } });

        const res = await request({
            uri: '/',
            method: 'POST',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns garbage while fetching user', async () => {
        mock.mockAll({ core: { badResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns unsuccessful response while fetching user', async () => {
        mock.mockAll({ core: { unauthorized: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns net error while fetching permissions', async () => {
        mock.mockAll({ mainPermissions: { netError: true } });

        const res = await request({
            uri: '/',
            method: 'POST',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns garbage while fetching permissions', async () => {
        mock.mockAll({ mainPermissions: { badResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns unsuccessful response while fetching permissions', async () => {
        mock.mockAll({ mainPermissions: { unauthorized: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns garbage while fetching approve permissions', async () => {
        mock.mockAll({ approvePermissions: { badResponse: true } });
        const event = await generator.createEvent({});

        const res = await request({
            uri: '/events/' + event.id,
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if oms-core returns unsuccessful response while fetching approve permissions', async () => {
        mock.mockAll({ approvePermissions: { unauthorized: true } });
        const event = await generator.createEvent({});

        const res = await request({
            uri: '/events/' + event.id,
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if body is not JSON', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: {
                'X-Auth-Token': 'blablabla',
                'Content-Type': 'application/json'
            },
            body: 'Totally not JSON'
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
    });

    test('should fail on accessing non-existant endpoint', async () => {
        const res = await request({
            uri: '/nonexistant',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });
});
