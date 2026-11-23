const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { CirclePermission } = require('../../models');

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
            path: '/circles/' + circle.id + '/permissions',
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
            path: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: 2147483647 }
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
            path: '/circles/' + circle.id + '/permissions',
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
            path: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: permission.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should succeed with the global permission of a circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const putPermissions = await generator.createPermission({ scope: 'global', action: 'put_permissions', object: 'circle' });
        const adminCircle = await generator.createCircle();
        await generator.createCircleMembership(adminCircle, user);
        await generator.createCirclePermission(adminCircle, putPermissions);

        const circle = await generator.createCircle();
        const permission = await generator.createPermission();

        const res = await request({
            path: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: permission.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(await CirclePermission.count({ where: { circle_id: circle.id, permission_id: permission.id } })).toEqual(1);
    });

    test('should fail with the permission in the local scope, also for a circle of the own body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const putPermissions = await generator.createPermission({ scope: 'local', action: 'put_permissions', object: 'circle' });
        const boardCircle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(boardCircle, user);
        await generator.createCirclePermission(boardCircle, putPermissions);

        const permission = await generator.createPermission();

        const res = await request({
            path: '/circles/' + boardCircle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: permission.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Permission global:put_permissions:circle is required, but not present.');
        expect(await CirclePermission.count({ where: { circle_id: boardCircle.id, permission_id: permission.id } })).toEqual(0);
    });

    test.each([
        ['missing', undefined],
        ['a text that is not a number', 'abc'],
        ['an empty text', ''],
        ['a list', [1]],
        ['an object', { id: 1 }],
        ['a fraction', 1.5],
        ['a boolean', true],
        ['null', null]
    ])('should return 400 if the permission id is %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'put_permissions', object: 'circle' });
        const circle = await generator.createCircle();

        const res = await request({
            path: '/circles/' + circle.id + '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { permission_id: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The permission ID is not valid.' });
        expect(await CirclePermission.count({ where: { circle_id: circle.id } })).toEqual(0);
    });
});
