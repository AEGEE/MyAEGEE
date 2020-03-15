const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Permissions creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const permission = generator.generatePermission({ scope: '' });

        const res = await request({
            uri: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('scope');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);

        const permission = generator.generatePermission();

        const res = await request({
            uri: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const permission = generator.generatePermission();

        const res = await request({
            uri: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.object).toEqual(permission.object);
    });
});
