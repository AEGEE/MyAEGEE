const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');

describe('API requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should answer the health check without a token', async () => {
        const res = await request({
            path: '/healthcheck',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual('network');
        expect(res.body.data).toHaveProperty('version');
    });

    test('should fail if X-Auth-Token is not specified', async () => {
        const res = await request({
            path: '/boards',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if core returns net error while fetching user', async () => {
        mock.mockAll({ core: { netError: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if core returns garbage while fetching user', async () => {
        mock.mockAll({ core: { badResponse: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if core returns unsuccessful response while fetching user', async () => {
        mock.mockAll({ core: { unauthorized: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if core returns net error while fetching permissions', async () => {
        mock.mockAll({ mainPermissions: { netError: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if core returns garbage while fetching permissions', async () => {
        mock.mockAll({ mainPermissions: { badResponse: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if core returns unsuccessful response while fetching permissions', async () => {
        mock.mockAll({ mainPermissions: { unauthorized: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: {
                'X-Auth-Token': 'blablabla'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    test('should not ask core for the board permissions if core rejects the user', async () => {
        const { omsManagePermissionsStub } = mock.mockAll({ core: { unauthorized: true } });
        const manageRequests = [];
        omsManagePermissionsStub.on('request', (req) => manageRequests.push(req));

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(401);
        expect(manageRequests).toEqual([]);
    });

    test('should name the service when it asks core for the board permissions', async () => {
        const { omsManagePermissionsStub } = mock.mockAll();
        const manageRequests = [];
        omsManagePermissionsStub.on('request', (req) => manageRequests.push(req));

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(manageRequests.length).toEqual(1);
        expect(manageRequests[0].headers['x-service']).toEqual('network');
        expect(manageRequests[0].headers['x-auth-token']).toEqual('blablabla');
    });

    test('should go on without local board permissions if core fails to list them', async () => {
        mock.mockAll({ mainPermissions: { viewOnly: true }, managePermissions: { netError: true } });

        const listRes = await request({
            path: '/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });
        expect(listRes.statusCode).toEqual(200);

        // The user is a member of body 34, but without the list holds no local permission.
        const createRes = await request({
            path: '/bodies/34/boards',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { elected_date: '2026-01-01', start_date: '2026-01-02', president: 1, secretary: 2, treasurer: 3 }
        });
        expect(createRes.statusCode).toEqual(403);
    });

    test('should fail if body is not JSON', async () => {
        const res = await request({
            path: '/bodies/34/boards',
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
            path: '/nonexistant',
            skipOpenApi: 'the not-found handler',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });
});
