const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { AccessToken, RefreshToken, User } = require('../../models');
const { sequelize } = require('../../lib/sequelize');

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
        const user = await generator.createUser({ password: 'testtest', gsuite_id: 'member@aegee.eu' });
        const res = await request({
            path: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: 'Member@aegee.eu',
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
                gsuite_id: 'someone@aegee.eu',
                password: 'testtest'
            });

            const querySpy = jest.spyOn(sequelize, 'query');
            try {
                for (const password of ['testtest', 'wrong-password']) {
                    for (const username of ['someone@example.com', 'someone', 'someone@aegee.eu', 'nobody', 'nobody@example.com', '']) {
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
});
