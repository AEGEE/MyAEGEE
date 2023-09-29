const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Circle add permission', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const permission = await generator.createPermission();

        const res = await request({
            uri: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: permission.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if permission is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'put_permissions', object: 'circle' });

        const circle = await generator.createCircle();

        const res = await request({
            uri: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: -1 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if permission is already there', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'put_permissions', object: 'circle' });

        const circle = await generator.createCircle();
        const permission = await generator.createPermission();
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: permission.id }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'put_permissions', object: 'circle' });

        const circle = await generator.createCircle();
        const permission = await generator.createPermission();

        const res = await request({
            uri: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: permission.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('errors');
    });
});
