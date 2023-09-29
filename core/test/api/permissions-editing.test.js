const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Permissions details', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the permission is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'permission' });

        const res = await request({
            uri: '/permissions/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'permission' });

        const permission = await generator.createPermission();

        const res = await request({
            uri: '/permissions/' + permission.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { scope: '' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('scope');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission();

        const res = await request({
            uri: '/permissions/' + permission.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { scope: 'local' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'permission' });

        const permission = await generator.createPermission();

        const res = await request({
            uri: '/permissions/' + permission.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { scope: 'local' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.scope).toEqual('local');
    });
});
