const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('User activation', () => {
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

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const res = await request({
            path: '/members/1337/active',
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
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const res = await request({
            path: '/members/' + user.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: 'aaa' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('active');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update_active', object: 'user' });

        const res = await request({
            path: '/members/' + user.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.active).toEqual(false);
    });

    test('should fail for yourself without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update_active', object: 'user' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.active).toEqual(false);
    });

    test('should fail for other person without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with the global permission of a circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.active).toEqual(false);

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(false);
    });

    test('should lift a suspension', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ active: false });
        const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.active).toEqual(true);
    });

    test('should fail with a permission of another name', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'member' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('Permission update_active:user is required, but not present.');

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(true);
    });

    test('should fail with the local permission for a member of another body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update_active', object: 'user' });
        const body = await generator.createBody();
        const otherBody = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(otherBody, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(true);
    });

    test('should end the sessions of the suspended member at their next request', async () => {
        const admin = await generator.createUser({ superadmin: true });
        const adminToken = await generator.createAccessToken(admin);
        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const member = await generator.createUser();
        const memberToken = await generator.createAccessToken(member);
        const memberRefreshToken = await generator.createRefreshToken(member);

        const before = await request({ path: '/members/me', headers: { 'X-Auth-Token': memberToken.value } });
        expect(before.statusCode).toEqual(200);

        const res = await request({
            path: '/members/' + member.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': adminToken.value },
            body: { active: false }
        });
        expect(res.statusCode).toEqual(200);

        const after = await request({ path: '/members/me', headers: { 'X-Auth-Token': memberToken.value } });
        expect(after.statusCode).toEqual(401);

        const renewal = await request({
            path: '/renew',
            method: 'POST',
            body: { refresh_token: memberRefreshToken.value }
        });
        expect(renewal.statusCode).toEqual(403);
    });
});
