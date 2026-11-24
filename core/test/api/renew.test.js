const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const config = require('../../config');
const { AccessToken, RefreshToken } = require('../../models');

// Only faking Date, so the DB driver and HTTP requests keep working.
const useFakeDate = (now) => jest.useFakeTimers({
    now,
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout']
});

const renew = (refreshToken) => request({
    path: '/renew',
    method: 'POST',
    headers: { 'X-Auth-Token': 'blablabla' },
    body: {
        refresh_token: refreshToken
    }
});

describe('Tokens renewal', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        jest.useRealTimers();
        await generator.clearAll();
    });

    test('should fail if the token is not found', async () => {
        const res = await request({
            path: '/renew',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                refresh_token: '123'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ mail_confirmed_at: new Date() });
        const refreshToken = await generator.createRefreshToken(user);
        const res = await request({
            path: '/renew',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                refresh_token: refreshToken.value
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should return a new refresh token and mark the old one as rotated', async () => {
        const user = await generator.createUser({ mail_confirmed_at: new Date() });
        const refreshToken = await generator.createRefreshToken(user);
        const res = await renew(refreshToken.value);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body.refresh_token).not.toEqual(refreshToken.value);

        const newToken = await RefreshToken.findOne({ where: { value: res.body.refresh_token } });
        expect(newToken.user_id).toEqual(user.id);
        expect(newToken.rotated_at).toEqual(null);

        await refreshToken.reload();
        expect(refreshToken.rotated_at).not.toEqual(null);
    });

    test('should accept the old token within the grace period and reject it after', async () => {
        const now = new Date();
        useFakeDate(now);

        const user = await generator.createUser({ mail_confirmed_at: new Date() });
        const refreshToken = await generator.createRefreshToken(user);
        const first = await renew(refreshToken.value);
        expect(first.statusCode).toEqual(200);

        jest.setSystemTime(now.getTime() + ((config.ttl.refresh_token_grace_period - 1) * 1000));
        const withinGrace = await renew(refreshToken.value);
        expect(withinGrace.statusCode).toEqual(200);
        expect(withinGrace.body).toHaveProperty('access_token');
        expect(withinGrace.body).toHaveProperty('refresh_token');

        jest.setSystemTime(now.getTime() + ((config.ttl.refresh_token_grace_period + 1) * 1000));
        const afterGrace = await renew(refreshToken.value);
        expect(afterGrace.statusCode).toEqual(403);
        expect(afterGrace.body.success).toEqual(false);
        expect(afterGrace.body).toHaveProperty('message');

        // The new token is not affected by the old one expiring.
        const withNewToken = await renew(first.body.refresh_token);
        expect(withNewToken.statusCode).toEqual(200);
    });

    test('should succeed for parallel renews with the same token', async () => {
        const user = await generator.createUser({ mail_confirmed_at: new Date() });
        const refreshToken = await generator.createRefreshToken(user);

        const responses = await Promise.all([renew(refreshToken.value), renew(refreshToken.value)]);

        for (const res of responses) {
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
        }
        expect(responses[0].body.refresh_token).not.toEqual(responses[1].body.refresh_token);
    });

    test('should not renew the tokens of a suspended member', async () => {
        const user = await generator.createUser({ mail_confirmed_at: new Date() });
        const refreshToken = await generator.createRefreshToken(user);
        await user.update({ active: false });

        const res = await renew(refreshToken.value);

        // The same answer as for a token that doesn't exist.
        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Token is not found.' });

        expect(await AccessToken.count({ where: { user_id: user.id } })).toEqual(0);
        expect(await RefreshToken.count({ where: { user_id: user.id } })).toEqual(1);

        await refreshToken.reload();
        expect(refreshToken.rotated_at).toEqual(null);
    });

    test('should renew the tokens again after the suspension is lifted', async () => {
        const user = await generator.createUser({ mail_confirmed_at: new Date(), active: false });
        const refreshToken = await generator.createRefreshToken(user);
        await user.update({ active: true });

        const res = await renew(refreshToken.value);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('access_token');
    });

    test.each([
        ['is missing', {}],
        ['is a number', { refresh_token: 5 }],
        ['is a list', { refresh_token: ['a'] }],
        ['is an object', { refresh_token: { a: 1 } }],
        ['is a boolean', { refresh_token: true }],
        ['is null', { refresh_token: null }]
    ])('should answer like for an unknown token if the token %s', async (name, body) => {
        const user = await generator.createUser();
        await generator.createRefreshToken(user);

        const res = await request({
            path: '/renew',
            method: 'POST',
            body
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Token is not found.' });
        expect(await RefreshToken.count()).toEqual(1);
    });
});
