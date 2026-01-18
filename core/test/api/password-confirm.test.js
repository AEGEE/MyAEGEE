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
            uri: '/password_confirm',
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
            uri: '/password_confirm',
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
            uri: '/password_confirm',
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
            uri: '/password_confirm',
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
            uri: '/password_confirm',
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
            uri: '/password_confirm',
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

    test('should work if the user is found with email with spaces/tabs', async () => {
        const user = await generator.createUser();
        const reset = await generator.createPasswordReset(user);

        const res = await request({
            uri: '/password_confirm',
            method: 'POST',
            body: { token: '\t\t\t   \t' + reset.value + '\t     \t', password: 'testtest' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });
});
