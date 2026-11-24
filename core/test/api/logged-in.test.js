const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { AccessToken, User } = require('../../models');

describe('Logged in middleware', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if the token is not provided', async () => {
        const res = await request({
            path: '/members/me',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the token is invalid', async () => {
        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the token expires', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user, { expires_at: new Date() });
        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should not accept the token of a suspended member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        await user.update({ active: false });

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should not count a request with the token of a suspended member as activity', async () => {
        const user = await generator.createUser({ active: false });
        const token = await generator.createAccessToken(user);

        await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.last_active).toEqual(null);
    });

    test('should treat a suspended member as not logged in where logging in is optional', async () => {
        const user = await generator.createUser({ superadmin: true, active: false });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view_deleted', object: 'body' });
        await generator.createBody({ type: 'antenna' });
        await generator.createBody({ type: 'working group' });

        // Without logging in only the antennae and contacts are listed.
        const list = await request({
            path: '/bodies',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(list.statusCode).toEqual(200);
        expect(list.body.data.length).toEqual(1);

        const all = await request({
            path: '/bodies?all=true',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(all.statusCode).toEqual(401);
    });

    test('should accept the token again after the suspension is lifted', async () => {
        const user = await generator.createUser({ active: false });
        const token = await generator.createAccessToken(user);
        await user.update({ active: true });

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
    });

    describe('a request that is not logged in', () => {
        const NOT_AUTHORIZED = { success: false, message: 'You are not authorized.' };

        test('should get the same answer without a token, with an unknown one and with an expired one', async () => {
            const user = await generator.createUser();
            const expired = await generator.createAccessToken(user, { expires_at: new Date(Date.now() - 1000) });

            for (const headers of [{}, { 'X-Auth-Token': '' }, { 'X-Auth-Token': 'blablabla' }, { 'X-Auth-Token': expired.value }]) {
                const res = await request({
                    path: '/members/me',
                    method: 'GET',
                    headers
                });

                expect(res.statusCode).toEqual(401);
                expect(res.body).toEqual(NOT_AUTHORIZED);
            }
        });

        test('should not count a request with an expired token as activity', async () => {
            const user = await generator.createUser();
            const expired = await generator.createAccessToken(user, { expires_at: new Date(Date.now() - 1000) });

            await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': expired.value }
            });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.last_active).toBeNull();
        });

        test('should not take a refresh token for an access token', async () => {
            const user = await generator.createUser();
            const refreshToken = await generator.createRefreshToken(user);

            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': refreshToken.value }
            });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual(NOT_AUTHORIZED);
        });

        test('should not take the token from another header', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { Authorization: 'Bearer ' + token.value }
            });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual(NOT_AUTHORIZED);
        });

        test('should not take a part of a token or a token in another case', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user, { value: 'abcdefgh12345678' });

            for (const value of [token.value.slice(0, 8), token.value.toUpperCase(), token.value + ' x', '%']) {
                const res = await request({
                    path: '/members/me',
                    method: 'GET',
                    headers: { 'X-Auth-Token': value }
                });

                expect(res.statusCode).toEqual(401);
            }
        });
    });

    describe('a request that is logged in', () => {
        test('should be answered for the member of the token', async () => {
            const user = await generator.createUser();
            const otherUser = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const otherToken = await generator.createAccessToken(otherUser);

            const res = await request({ path: '/members/me', method: 'GET', headers: { 'X-Auth-Token': token.value } });
            const otherRes = await request({ path: '/members/me', method: 'GET', headers: { 'X-Auth-Token': otherToken.value } });

            expect(res.body.data.id).toEqual(user.id);
            expect(otherRes.body.data.id).toEqual(otherUser.id);
        });

        test('should count as activity of that member only', async () => {
            const user = await generator.createUser();
            const otherUser = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const before = Date.now();
            await request({ path: '/members/me', method: 'GET', headers: { 'X-Auth-Token': token.value } });

            expect((await User.findByPk(user.id)).last_active.getTime()).toBeGreaterThanOrEqual(before - 1000);
            expect((await User.findByPk(otherUser.id)).last_active).toBeNull();
        });

        test('should keep the token as it is', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            await request({ path: '/members/me', method: 'GET', headers: { 'X-Auth-Token': token.value } });

            const tokens = await AccessToken.findAll();
            expect(tokens.length).toEqual(1);
            expect(tokens[0].value).toEqual(token.value);
            expect(tokens[0].expires_at.getTime()).toEqual(token.expires_at.getTime());
        });
    });
});
