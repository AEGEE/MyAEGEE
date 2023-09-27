const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('User primary body setting', () => {
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
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true, primary_body_id: body.id });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/1337/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true, primary_body_id: body.id });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.primary_body_id).toEqual(null);
    });

    test('should fail if body is not found', async () => {
        const user = await generator.createUser({ superadmin: true, });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if user is not a member', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: body.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should allow setting body', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: body.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.primary_body_id).toEqual(body.id);
    });

    test('should work for yourself without permission', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ primary_body_id: body.id });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser({ primary_body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            uri: '/members/' + otherUser.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.primary_body_id).toEqual(null);
    });

    test('should fail for other person without permission', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ primary_body_id: body.id });

        const res = await request({
            uri: '/members/' + otherUser.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
