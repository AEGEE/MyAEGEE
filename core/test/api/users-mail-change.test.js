const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { MailChange } = require('../../models');

describe('User mail change', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should return 404 if the user is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/1337/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new_email is not provided', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'not-valid' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('new_email');
    });

    test('should fail if the email is not unique', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createUser({ email: 'test@example.com' });

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@example.com' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new mail in in @aegee.eu', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@aegee.eu' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new mail in in @aegee.org', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@aegee.org' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailer fails', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const changeFromDb = await MailChange.findOne({ where: { user_id: user.id } });
        expect(changeFromDb).not.toEqual(null);
    });

    test('should work for current user for /me without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should work for current user for /:user_id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            uri: '/members/' + otherUser.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            uri: '/members/' + otherUser.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
