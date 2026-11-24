const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { AccessToken, RefreshToken } = require('../../models');

describe('Logout', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if the token is not found', async () => {
        const res = await request({
            path: '/logout',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                refresh_token: 'test'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if token is empty', async () => {
        await generator.createUser();

        const res = await request({
            path: '/logout',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser();
        const token = await generator.createRefreshToken(user);

        const res = await request({
            path: '/logout',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                refresh_token: token.value
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('errors');
    });

    test.each([
        ['a number', 5],
        ['a list', ['a']],
        ['an object', { a: 1 }],
        ['a boolean', true]
    ])('should answer 400 if the token is %s', async (name, value) => {
        const user = await generator.createUser();
        await generator.createRefreshToken(user);

        const res = await request({
            path: '/logout',
            method: 'POST',
            body: { refresh_token: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'Token is not provided.' });
    });

    test('should delete the refresh token, and only that one', async () => {
        const user = await generator.createUser();
        const token = await generator.createRefreshToken(user);
        const otherSession = await generator.createRefreshToken(user);
        const otherUser = await generator.createUser();
        const otherToken = await generator.createRefreshToken(otherUser);

        const res = await request({
            path: '/logout',
            method: 'POST',
            body: { refresh_token: token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'You are now logged out.' });

        const tokens = await RefreshToken.findAll({ order: [['id', 'ASC']] });
        expect(tokens.map((item) => item.value)).toEqual([otherSession.value, otherToken.value]);
    });

    test('should answer 403 for a token that was logged out already', async () => {
        const user = await generator.createUser();
        const token = await generator.createRefreshToken(user);
        const logout = () => request({
            path: '/logout',
            method: 'POST',
            body: { refresh_token: token.value }
        });

        expect((await logout()).statusCode).toEqual(200);

        const res = await logout();
        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Token is not found.' });
    });

    test('should keep the access tokens of the member until they expire', async () => {
        const user = await generator.createUser();
        const refreshToken = await generator.createRefreshToken(user);
        const accessToken = await generator.createAccessToken(user);

        await request({
            path: '/logout',
            method: 'POST',
            body: { refresh_token: refreshToken.value }
        });

        expect(await AccessToken.count({ where: { user_id: user.id } })).toEqual(1);

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': accessToken.value }
        });
        expect(res.statusCode).toEqual(200);
    });

    test('should not take an access token for a refresh token', async () => {
        const user = await generator.createUser();
        const accessToken = await generator.createAccessToken(user);

        const res = await request({
            path: '/logout',
            method: 'POST',
            body: { refresh_token: accessToken.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Token is not found.' });
        expect(await AccessToken.count()).toEqual(1);
    });

    test('should say that the token is missing if it is an empty text', async () => {
        const res = await request({
            path: '/logout',
            method: 'POST',
            body: { refresh_token: '' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'Token is not provided.' });
    });
});
