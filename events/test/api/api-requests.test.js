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

    it('should reject requests without X-Auth-Token', async () => {
        const res = await request({
            uri: '/',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the user is unauthorized', async () => {
        mock.mockAll({ core: { unauthorized: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core is unaccessible', async () => {
        mock.mockAll({ core: { netError: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns non-JSON data', async () => {
        mock.mockAll({ core: { badResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns unsuccessful response', async () => {
        mock.mockAll({ core: { unsuccessfulResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if body is not JSON', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: 'Some random string'
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
    });

    it('should fail on accessing non-existant endpoint', async () => {
        const res = await request({
            uri: '/nonexistant',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });
});
