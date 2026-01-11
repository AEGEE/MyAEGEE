const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('User details', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the user is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            uri: '/members/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should find the user by username', async () => {
        const user = await generator.createUser({ superadmin: true, username: 'test' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            uri: '/members/test',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should find the user by username case-insensitive', async () => {
        const user = await generator.createUser({ superadmin: true, username: 'test' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            uri: '/members/TEST',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should find the user by id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('work for the current user for /me without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('work for the current user for /:user_id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should work with join_request permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'join_request', action: 'view', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createJoinRequest(body, otherUser);

        const res = await request({
            uri: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(otherUser.id);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'view', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            uri: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(otherUser.id);
    });

    test('should work with global view_members permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const otherUser = await generator.createUser();

        const res = await request({
            uri: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(otherUser.id);
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            uri: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
