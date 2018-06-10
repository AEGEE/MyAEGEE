const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
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

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if body oms-core returns net error', async () => {
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

    test('should fail if body oms-core returns garbage', async () => {
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

    test('should fail if body oms-core returns unsuccessful response', async () => {
        mock.mockAll({ core: { unauthorized: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(403);
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
