const { startServer, stopServer } = require('../../lib/server');
const { PasswordReset, AccessToken, RefreshToken, User } = require('../../models');

const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Password confirm', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the password reset is not found', async () => {
        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: '1', password: 'testtest' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if no token is provided', async () => {
        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: {}
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if password is not provided', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('password');
    });

    test('should fail if password is invalid', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'short' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('password');
    });

    test('should fail if token is expired', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user, { expires_at: new Date() });

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'short' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should work if the token is found', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'testtest' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const resets = await PasswordReset.count({ where: { user_id: user.id } });
        expect(resets).toEqual(0);

        const accessTokens = await AccessToken.count({ where: { user_id: user.id } });
        expect(accessTokens).toEqual(0);

        const refreshTokens = await RefreshToken.count({ where: { user_id: user.id } });
        expect(refreshTokens).toEqual(0);

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest')).toEqual(true);
    });

    test('should refuse the token of a suspended member', async () => {
        const user = await generator.createUser({ active: false });
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'testtest' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Token is invalid.');

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('testtest')).toEqual(false);
    });

    test('should work if the user is found with email with spaces/tabs', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: '\t\t\t   \t' + reset.value + '\t     \t', password: 'testtest' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test.each([
        ['a number', 5],
        ['a list', ['a']],
        ['an object', { a: 1 }],
        ['a boolean', true]
    ])('should return 404 if the token is %s', async (name, value) => {
        const user = await generator.createUser();
        await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: value, password: 'testtest' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'Token is invalid.' });
        expect(await PasswordReset.count()).toEqual(1);
    });

    test.each([
        ['a number', 12345678],
        ['a list', ['testtest']],
        ['an object', { a: 'testtest' }],
        ['a boolean', true]
    ])('should fail if the password is %s', async (name, value) => {
        const user = await generator.createUser({ password: 'the-old-password' });
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('password');

        // Nothing is used up: the reset still works and the password is the old one.
        expect(await PasswordReset.count()).toEqual(1);
        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('the-old-password')).toEqual(true);
    });

    test('should say which of the two is wrong with the token', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user, { expires_at: new Date(Date.now() - 1000) });

        const unknown = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: 'does-not-exist', password: 'testtest' }
        });
        expect(unknown.statusCode).toEqual(404);
        expect(unknown.body).toEqual({ success: false, message: 'Token is invalid.' });

        const expired = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'testtest' }
        });
        expect(expired.statusCode).toEqual(404);
        expect(expired.body).toEqual({ success: false, message: 'Token is expired.' });
    });

    test('should keep the password and the sessions if the token is expired', async () => {
        const user = await generator.createUser({ password: 'the-old-password' });
        const reset = await generator.createPasswordReset(user, { expires_at: new Date(Date.now() - 1000) });
        await generator.createAccessToken(user);
        await generator.createRefreshToken(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'the-new-password' }
        });

        expect(res.statusCode).toEqual(404);

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('the-old-password')).toEqual(true);
        expect(await AccessToken.count({ where: { user_id: user.id } })).toEqual(1);
        expect(await RefreshToken.count({ where: { user_id: user.id } })).toEqual(1);
    });

    test('should name the rule that the new password breaks, and keep the sessions', async () => {
        const user = await generator.createUser({ password: 'the-old-password' });
        const reset = await generator.createPasswordReset(user);
        await generator.createAccessToken(user);
        await generator.createRefreshToken(user);

        const tooShort = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'short' }
        });
        expect(tooShort.statusCode).toEqual(422);
        expect(tooShort.body).toEqual({
            success: false,
            errors: { password: ['Password should be at least 8 characters long.'] }
        });

        const missing = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value }
        });
        expect(missing.statusCode).toEqual(422);
        expect(missing.body.errors.password).toContain('Password should be set.');

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('the-old-password')).toEqual(true);
        expect(await PasswordReset.count({ where: { user_id: user.id } })).toEqual(1);
        expect(await AccessToken.count({ where: { user_id: user.id } })).toEqual(1);
        expect(await RefreshToken.count({ where: { user_id: user.id } })).toEqual(1);
    });

    test('should accept a token only once', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const first = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'the-first-password' }
        });
        expect(first.statusCode).toEqual(200);
        expect(first.body).toEqual({ success: true, message: 'Password was changed successfully.' });

        const second = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'the-second-password' }
        });
        expect(second.statusCode).toEqual(404);
        expect(second.body).toEqual({ success: false, message: 'Token is invalid.' });

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(await userFromDb.checkPassword('the-first-password')).toEqual(true);
    });

    test('should keep the password, the sessions and the resets of the other members', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const otherUser = await generator.createUser({ password: 'the-other-password' });
        await generator.createPasswordReset(otherUser);
        await generator.createAccessToken(otherUser);
        await generator.createRefreshToken(otherUser);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'the-new-password' }
        });

        expect(res.statusCode).toEqual(200);

        const otherFromDb = await User.scope('withPassword').findByPk(otherUser.id);
        expect(await otherFromDb.checkPassword('the-other-password')).toEqual(true);
        expect(await PasswordReset.count({ where: { user_id: otherUser.id } })).toEqual(1);
        expect(await AccessToken.count({ where: { user_id: otherUser.id } })).toEqual(1);
        expect(await RefreshToken.count({ where: { user_id: otherUser.id } })).toEqual(1);
    });

    test('should let the member log in with the new password only', async () => {
        const user = await generator.createUser({ password: 'the-old-password' });
        const reset = await generator.createPasswordReset(user);

        await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'the-new-password' }
        });

        const withOld = await request({
            path: '/login',
            method: 'POST',
            body: { username: user.email, password: 'the-old-password' }
        });
        expect(withOld.statusCode).toEqual(403);

        const withNew = await request({
            path: '/login',
            method: 'POST',
            body: { username: user.email, password: 'the-new-password' }
        });
        expect(withNew.statusCode).toEqual(200);
    });

    test('should not store the new password as it is sent', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            path: '/password_confirm',
            method: 'POST',
            body: { token: reset.value, password: 'the-new-password' }
        });

        expect(res.statusCode).toEqual(200);

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(userFromDb.password).not.toEqual('the-new-password');
        expect(userFromDb.password).toMatch(/^\$2[aby]\$/);
    });
});
