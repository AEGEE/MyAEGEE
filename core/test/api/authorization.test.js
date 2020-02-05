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

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the password is wrong', async () => {
        const user = await generator.createUser({ password: 'test' })
        const res = await request({
            uri: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'test2'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the email is not confirmed', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: null })
        const res = await request({
            uri: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'test'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() })
        const res = await request({
            uri: '/login/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                username: user.email,
                password: 'test'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });
});
