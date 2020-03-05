const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Bodies status', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the body is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const res = await request({
            uri: '/bodies/1337/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'aaa' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');
    });

    test('should fail if no permissions', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'aaa' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'deleted' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errrors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.status).toEqual('deleted');
    });
});
