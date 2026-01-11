const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

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

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'member' });

        const res = await request({
            uri: '/members/1337/active',
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

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/active',
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

        await generator.createPermission({ scope: 'local', action: 'update_active', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/active',
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
            uri: '/members/' + user.id + '/active',
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
        const permission = await generator.createPermission({ scope: 'local', action: 'update_active', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            uri: '/members/' + otherUser.id + '/active',
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
            uri: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
