const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { AccessToken, RefreshToken, User } = require('../../models');
const { sequelize } = require('../../lib/sequelize');
const constants = require('../../lib/constants');
const config = require('../../config');

describe('Authorization', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if the user is not found', async () => {
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'non-existant@test.io',
                password: 'aaaa'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the password is wrong', async () => {
        const user = await generator.createUser();
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'test2'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if email is empty', async () => {
        await generator.createUser();
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: '',
                password: 'test2'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the email is not confirmed', async () => {
        const user = await generator.createUser({ password: 'testtest', mail_confirmed_at: null });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    // TODO: rethink that.
    // test('should fail if user is not valid', async () => {
    //     const user = await generator.createUser({ password: 'testtest', address: null });
    //     const res = await request({
    //         path: '/login/',
    //         method: 'POST',
    //         headers: { 'X-Auth-Token': 'blablabla' },
    //         body: {
    //             username: user.email,
    //             password: 'testtest'
    //         }
    //     });

    //     expect(res.statusCode).toEqual(422);
    //     expect(res.body.success).toEqual(false);
    //     expect(res.body).toHaveProperty('errors');
    //     expect(res.body).not.toHaveProperty('data');
    //     expect(res.body.errors).toHaveProperty('address');
    // });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ password: 'testtest' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should find by username', async () => {
        await generator.createUser({ password: 'testtest', username: 'admin' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'admin',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should find user when trimming', async () => {
        const user = await generator.createUser({ password: 'testtest' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: '\t\t   \t\t    \t' + user.email + '\t\t   \t\t    \t',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should find by email case-insensitive', async () => {
        await generator.createUser({ password: 'testtest', email: 'admin@example.com' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'ADMIN@EXAMPLE.COM',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should find by username case-insensitive', async () => {
        await generator.createUser({ password: 'testtest', username: 'admin' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'ADMIN',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should find by the Google Workspace account', async () => {
        const user = await generator.createUser({ password: 'testtest', gsuite_id: 'example-member@aegee.eu' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'example-Member@aegee.eu',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const tokenFromDb = await AccessToken.findOne({ where: { value: res.body.access_token } });
        expect(tokenFromDb.user_id).toEqual(user.id);
    });

    test('should identify an account by the login email before the Google Workspace account', async () => {
        // Saved without validation, like a value from before the domain rule.
        await User.create(
            generator.generateUser({ password: 'firstfirst', gsuite_id: 'shared@example.com' }),
            { validate: false }
        );
        const user = await generator.createUser({ password: 'testtest', email: 'shared@example.com' });

        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'shared@example.com',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const tokenFromDb = await AccessToken.findOne({ where: { value: res.body.access_token } });
        expect(tokenFromDb.user_id).toEqual(user.id);
    });

    test('should identify an account by the login email first, whichever account is older', async () => {
        const user = await generator.createUser({ password: 'testtest', email: 'shared@example.com' });
        await User.create(
            generator.generateUser({ password: 'secondsecond', gsuite_id: 'shared@example.com' }),
            { validate: false }
        );

        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'shared@example.com',
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const tokenFromDb = await AccessToken.findOne({ where: { value: res.body.access_token } });
        expect(tokenFromDb.user_id).toEqual(user.id);
    });

    describe('answers and exact lookups', () => {
        const login = (username, password) => request({
            path: '/login/',
            method: 'POST',
            body: { username, password }
        });

        test('should answer the same for an unknown account and a wrong password', async () => {
            const user = await generator.createUser({ password: 'testtest' });

            const unknown = await login('nobody@example.com', 'testtest');
            const wrongPassword = await login(user.email, 'wrong-password');

            expect(unknown.statusCode).toEqual(403);
            expect(wrongPassword.statusCode).toEqual(403);
            expect(unknown.body.success).toEqual(false);
            expect(unknown.body).toHaveProperty('message');
            expect(unknown.body).toEqual(wrongPassword.body);

            expect(await AccessToken.count()).toEqual(0);
        });

        test('should answer the same if no password is sent', async () => {
            const user = await generator.createUser({ password: 'testtest' });

            const wrongPassword = await login(user.email, 'wrong-password');
            const noPasswordForAccount = await request({ path: '/login/', method: 'POST', body: { username: user.email } });
            const noPasswordForUnknown = await request({ path: '/login/', method: 'POST', body: { username: 'nobody@example.com' } });

            expect(noPasswordForAccount.statusCode).toEqual(403);
            expect(noPasswordForAccount.body).toEqual(wrongPassword.body);
            expect(noPasswordForUnknown.statusCode).toEqual(403);
            expect(noPasswordForUnknown.body).toEqual(wrongPassword.body);
        });

        test('should answer the same for a wrong password on an account that is not confirmed', async () => {
            const user = await generator.createUser({ password: 'testtest', mail_confirmed_at: null });

            const unknown = await login('nobody@example.com', 'testtest');
            const wrongPassword = await login(user.email, 'wrong-password');

            expect(wrongPassword.statusCode).toEqual(403);
            expect(wrongPassword.body).toEqual(unknown.body);
        });

        test('should answer the same for a login name that is not a string', async () => {
            const user = await generator.createUser({ password: 'testtest' });
            const wrongPassword = await login(user.email, 'wrong-password');

            for (const username of [{ email: user.email }, [user.email], 42, true, null]) {
                const res = await login(username, 'testtest');

                expect(res.statusCode).toEqual(403);
                expect(res.body).toEqual(wrongPassword.body);
            }

            expect(await AccessToken.count()).toEqual(0);
        });

        test('should run the same account lookups whichever of them finds an account', async () => {
            await generator.createUser({
                username: 'someone',
                email: 'someone@example.com',
                gsuite_id: 'example-someone@aegee.eu',
                password: 'testtest'
            });

            const querySpy = jest.spyOn(sequelize, 'query');
            try {
                for (const password of ['testtest', 'wrong-password']) {
                    for (const username of ['someone@example.com', 'someone', 'example-someone@aegee.eu', 'nobody', 'nobody@example.com', '']) {
                        querySpy.mockClear();
                        await login(username, password);

                        // The columns the login name was compared with, in the order of the queries.
                        const lookups = querySpy.mock.calls
                            .map(([query]) => (typeof query === 'string' ? query : query.query))
                            .filter((query) => /FROM "users"/.test(query))
                            .map((query) => query.match(/WHERE lower\("(\w+)"\) = /))
                            .filter((match) => match)
                            .map((match) => match[1]);

                        expect(lookups).toEqual(['email', 'username', 'gsuite_id']);
                    }
                }
            } finally {
                querySpy.mockRestore();
            }
        });

        test('should not treat % as a wildcard', async () => {
            await generator.createUser({ password: 'testtest' });

            const unknown = await login('nobody@example.com', 'testtest');
            for (const username of ['%', '%@%', '%%']) {
                const res = await login(username, 'testtest');

                expect(res.statusCode).toEqual(403);
                expect(res.body).toEqual(unknown.body);
            }

            expect(await AccessToken.count()).toEqual(0);
        });

        test('should treat quotes and backslashes as plain characters', async () => {
            await generator.createUser({ password: 'testtest' });

            const unknown = await login('nobody@example.com', 'testtest');
            for (const username of ['\' OR \'\'=\'', '\\\' OR 1=1 --', '\\', '"']) {
                const res = await login(username, 'testtest');

                expect(res.statusCode).toEqual(403);
                expect(res.body).toEqual(unknown.body);
            }

            expect(await AccessToken.count()).toEqual(0);
        });

        test('should not treat _ as a wildcard in an email', async () => {
            await generator.createUser({ password: 'testtest', email: 'axb@example.com' });

            const res = await login('a_b@example.com', 'testtest');

            expect(res.statusCode).toEqual(403);
            expect(await AccessToken.count()).toEqual(0);
        });

        test('should find the exact username if another one only differs where it has an underscore', async () => {
            await generator.createUser({ password: 'firstfirst', username: 'somexone' });
            const user = await generator.createUser({ password: 'testtest', username: 'some_one' });

            const res = await login('some_one', 'testtest');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);

            const tokenFromDb = await AccessToken.findOne({ where: { value: res.body.access_token } });
            expect(tokenFromDb.user_id).toEqual(user.id);
        });

        test('should find an email with a dollar sign', async () => {
            const user = await generator.createUser({ password: 'testtest', email: 'some$one@example.com' });

            const res = await login('some$one@example.com', 'testtest');

            expect(res.statusCode).toEqual(200);

            const tokenFromDb = await AccessToken.findOne({ where: { value: res.body.access_token } });
            expect(tokenFromDb.user_id).toEqual(user.id);
        });

        test('should find an email that was saved with uppercase letters', async () => {
            // An address from before emails were saved in lowercase.
            const user = await User.create(
                generator.generateUser({ password: 'testtest', email: 'Mixed.Case@Example.com' }),
                { validate: false }
            );

            const res = await login('mixed.case@example.com', 'testtest');

            expect(res.statusCode).toEqual(200);

            const tokenFromDb = await AccessToken.findOne({ where: { value: res.body.access_token } });
            expect(tokenFromDb.user_id).toEqual(user.id);
        });
    });

    test('should not revoke the other sessions of the user', async () => {
        const user = await generator.createUser({ password: 'testtest' });
        const otherSession = await generator.createRefreshToken(user);
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(200);

        const tokensFromDb = await RefreshToken.findAll({ where: { user_id: user.id } });
        expect(tokensFromDb.map((t) => t.value).sort()).toEqual([otherSession.value, res.body.refresh_token].sort());
    });

    test('should not log in a suspended member', async () => {
        const user = await generator.createUser({ password: 'testtest', active: false });
        const res = await request({
            path: '/login/',
            method: 'POST',
            body: {
                username: user.email,
                password: 'testtest'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('This account is suspended.');
        expect(res.body).not.toHaveProperty('access_token');
        expect(res.body).not.toHaveProperty('refresh_token');

        expect(await AccessToken.count({ where: { user_id: user.id } })).toEqual(0);
        expect(await RefreshToken.count({ where: { user_id: user.id } })).toEqual(0);

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.last_logged_in).toEqual(null);
    });

    test('should answer a suspended member with a wrong password like any wrong password', async () => {
        const user = await generator.createUser({ password: 'testtest', active: false });
        const wrongPassword = await request({
            path: '/login/',
            method: 'POST',
            body: { username: user.email, password: 'testtest2' }
        });
        const unknownAccount = await request({
            path: '/login/',
            method: 'POST',
            body: { username: 'nobody@example.com', password: 'testtest2' }
        });

        expect(wrongPassword.statusCode).toEqual(403);
        expect(wrongPassword.body).toEqual(unknownAccount.body);
    });

    test('should log a member in again after the suspension is lifted', async () => {
        const user = await generator.createUser({ password: 'testtest', active: false });
        await user.update({ active: true });

        const res = await request({
            path: '/login/',
            method: 'POST',
            body: { username: user.email, password: 'testtest' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('access_token');
    });

    describe('what a login gives and stores', () => {
        test('should answer with the two tokens of a new session, and nothing else', async () => {
            const user = await generator.createUser({ password: 'testtest' });

            const before = Date.now();
            const res = await request({
                path: '/login',
                method: 'POST',
                body: { username: user.email, password: 'testtest' }
            });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body).sort()).toEqual(['access_token', 'refresh_token', 'success']);
            expect(res.body.success).toEqual(true);
            expect(res.body.access_token.length).toEqual(constants.TOKEN_LENGTH.ACCESS_TOKEN);
            expect(res.body.refresh_token.length).toEqual(constants.TOKEN_LENGTH.REFRESH_TOKEN);

            const accessTokens = await AccessToken.findAll();
            expect(accessTokens.length).toEqual(1);
            expect(accessTokens[0].value).toEqual(res.body.access_token);
            expect(accessTokens[0].user_id).toEqual(user.id);
            expect(accessTokens[0].expires_at.getTime()).toBeGreaterThanOrEqual(before + ((config.ttl.access_token - 1) * 1000));
            expect(accessTokens[0].expires_at.getTime()).toBeLessThanOrEqual(Date.now() + (config.ttl.access_token * 1000));

            const refreshTokens = await RefreshToken.findAll();
            expect(refreshTokens.length).toEqual(1);
            expect(refreshTokens[0].value).toEqual(res.body.refresh_token);
            expect(refreshTokens[0].user_id).toEqual(user.id);
            expect(refreshTokens[0].rotated_at).toBeNull();

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.last_logged_in.getTime()).toBeGreaterThanOrEqual(before - 1000);
            expect(userFromDb.last_active.getTime()).toBeGreaterThanOrEqual(before - 1000);
        });

        test('should give an access token that the other routes accept', async () => {
            const user = await generator.createUser({ password: 'testtest' });

            const login = await request({
                path: '/login',
                method: 'POST',
                body: { username: user.username, password: 'testtest' }
            });

            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': login.body.access_token }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(user.id);
        });

        test('should give a refresh token that can be renewed and logged out', async () => {
            const user = await generator.createUser({ password: 'testtest' });

            const login = await request({
                path: '/login',
                method: 'POST',
                body: { username: user.email, password: 'testtest' }
            });

            const renewed = await request({
                path: '/renew',
                method: 'POST',
                body: { refresh_token: login.body.refresh_token }
            });
            expect(renewed.statusCode).toEqual(200);

            const loggedOut = await request({
                path: '/logout',
                method: 'POST',
                body: { refresh_token: renewed.body.refresh_token }
            });
            expect(loggedOut.statusCode).toEqual(200);
        });

        test.each([
            ['an unknown account', { username: 'nobody@example.com', password: 'testtest' }, 'Username or password is not valid.'],
            ['a wrong password', { username: 'some.one@example.com', password: 'testtest2' }, 'Username or password is not valid.'],
            ['the password in another case', { username: 'some.one@example.com', password: 'TESTTEST' }, 'Username or password is not valid.'],
            ['the password with a space after it', { username: 'some.one@example.com', password: 'testtest ' }, 'Username or password is not valid.'],
            ['no password', { username: 'some.one@example.com' }, 'Username or password is not valid.'],
            ['no username', { password: 'testtest' }, 'Username or password is not valid.'],
            ['an account that is not confirmed', { username: 'not.confirmed@example.com', password: 'testtest' }, 'Please confirm your mail first.']
        ])('should store no tokens and no login for %s', async (name, body, message) => {
            await generator.createUser({ email: 'some.one@example.com', password: 'testtest' });
            await generator.createUser({ email: 'not.confirmed@example.com', password: 'testtest', mail_confirmed_at: null });

            const res = await request({
                path: '/login',
                method: 'POST',
                body
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message });

            expect(await AccessToken.count()).toEqual(0);
            expect(await RefreshToken.count()).toEqual(0);
            for (const userFromDb of await User.findAll()) {
                expect(userFromDb.last_logged_in).toBeNull();
            }
        });

        test('should give every login a session of its own', async () => {
            const user = await generator.createUser({ password: 'testtest' });
            const login = () => request({
                path: '/login',
                method: 'POST',
                body: { username: user.email, password: 'testtest' }
            });

            const first = await login();
            const second = await login();

            expect(first.body.access_token).not.toEqual(second.body.access_token);
            expect(first.body.refresh_token).not.toEqual(second.body.refresh_token);
            expect(await AccessToken.count({ where: { user_id: user.id } })).toEqual(2);
            expect(await RefreshToken.count({ where: { user_id: user.id } })).toEqual(2);
        });
    });
});
