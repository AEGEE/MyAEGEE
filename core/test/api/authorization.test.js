const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

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
            uri: '/login/',
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
            uri: '/login/',
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
            uri: '/login/',
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
            uri: '/login/',
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
    //         uri: '/login/',
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
            uri: '/login/',
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
            uri: '/login/',
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
            uri: '/login/',
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
            uri: '/login/',
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
            uri: '/login/',
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
});
