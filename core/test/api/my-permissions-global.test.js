const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('My permissions global', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should list the global permission that is assigned to a circle user is member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            uri: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    test('should not list the local permissions that is assigned to a circle user is member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            uri: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list the global permission that is assigned to a circle user is indirectly a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id });

        await generator.createCirclePermission(firstCircle, permission);
        await generator.createCircleMembership(thirdCircle, user);

        const res = await request({
            uri: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    test('should not list the global permission that is assigned to a circle user is not a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list all permissions if a user is superadmin', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });
});
