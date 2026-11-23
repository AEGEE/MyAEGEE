const { startServer, stopServer } = require('../../lib/server');
const { User } = require('../../models');
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
        const user = await generator.createUser({ password: 'testtest', superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/1337/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if old password is incorrect', async () => {
        const user = await generator.createUser({ password: 'testtest', superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'not right', password: 'short' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ password: 'testtest', superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'short' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('password');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ password: 'testtest', superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest2')).toEqual(true);
    });

    test('should work for yourself without permission', async () => {
        const user = await generator.createUser({ password: 'testtest', superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest2')).toEqual(true);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ password: 'testtest', superadmin: true });

        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.scope('withPassword').findByPk(otherUser.id);
        expect(await userFromDb.checkPassword('testtest2')).toEqual(true);
    });

    test('should fail for other person without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ password: 'testtest', superadmin: true });

        const res = await request({
            path: '/members/' + otherUser.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test.each([
        ['is missing', {}],
        ['is a number', { old_password: 5 }],
        ['is a list', { old_password: ['testtest'] }],
        ['is an object', { old_password: { a: 1 } }],
        ['is null', { old_password: null }]
    ])('should fail if the old password %s', async (name, fields) => {
        const user = await generator.createUser({ password: 'testtest' });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ...fields, password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, message: 'The old password is invalid.' });

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest')).toEqual(true);
    });

    test.each([
        ['a number', 12345678],
        ['a list', ['testtest2']],
        ['an object', { a: 'testtest2' }],
        ['a boolean', true]
    ])('should fail if the new password is %s', async (name, value) => {
        const user = await generator.createUser({ password: 'testtest' });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('password');

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest')).toEqual(true);
    });

    test('should answer with a message only, and store the new password as a hash', async () => {
        const user = await generator.createUser({ password: 'testtest' });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'The password was changed.' });

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(userFromDb.password).not.toEqual('testtest2');
        expect(await userFromDb.checkPassword('testtest2')).toEqual(true);
        expect(await userFromDb.checkPassword('testtest')).toEqual(false);
    });

    test('should let the member log in with the new password only', async () => {
        const user = await generator.createUser({ password: 'testtest' });
        const token = await generator.createAccessToken(user);

        await request({
            path: '/members/me/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        const login = (password) => request({
            path: '/login',
            method: 'POST',
            body: { username: user.email, password }
        });

        expect((await login('testtest')).statusCode).toEqual(403);
        expect((await login('testtest2')).statusCode).toEqual(200);
    });

    test('should need the password of the member, not the one of who asks', async () => {
        const manager = await generator.createUser({ password: 'the-own-password', superadmin: true });
        const token = await generator.createAccessToken(manager);
        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const member = await generator.createUser({ password: 'testtest' });

        const res = await request({
            path: '/members/' + member.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'the-own-password', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, message: 'The old password is invalid.' });

        const memberFromDb = await User.scope('withPassword').findByPk(member.id);
        expect(await memberFromDb.checkPassword('testtest')).toEqual(true);

        const managerFromDb = await User.scope('withPassword').findByPk(manager.id);
        expect(await managerFromDb.checkPassword('the-own-password')).toEqual(true);
    });

    test('should change the password of that member only', async () => {
        const user = await generator.createUser({ password: 'testtest' });
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser({ password: 'testtest' });

        const res = await request({
            path: '/members/me/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(200);

        const otherFromDb = await User.scope('withPassword').findByPk(otherUser.id);
        expect(await otherFromDb.checkPassword('testtest')).toEqual(true);
    });

    test.each([
        ['too short', 'short', 'Password should be at least 8 characters long.'],
        ['empty', '', 'Password should be set.']
    ])('should name the rule for a new password that is %s, and keep the old one', async (name, password, message) => {
        const user = await generator.createUser({ password: 'testtest' });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password }
        });

        expect(res.statusCode).toEqual(422);
        expect(Object.keys(res.body).sort()).toEqual(['errors', 'success']);
        expect(Object.keys(res.body.errors)).toEqual(['password']);
        expect(res.body.errors.password).toContain(message);

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest')).toEqual(true);
    });

    test('should name the permission and keep the password for another member without it', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser({ password: 'testtest' });

        const res = await request({
            path: '/members/' + otherUser.id + '/password',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { old_password: 'testtest', password: 'testtest2' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Permission update:member is required, but not present.' });

        const otherFromDb = await User.scope('withPassword').findByPk(otherUser.id);
        expect(await otherFromDb.checkPassword('testtest')).toEqual(true);
    });
});
