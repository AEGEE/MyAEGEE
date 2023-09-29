const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

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
            uri: '/logout',
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
            uri: '/logout',
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
            uri: '/logout',
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
});
