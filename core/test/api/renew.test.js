const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Tokens renewal', () => {
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
            uri: '/renew',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                token: '123'
            }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });


    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ mail_confirmed_at: new Date() });
        const refreshToken = await generator.createRefreshToken({}, user);
        const res = await request({
            uri: '/renew',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                token: refreshToken.value
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });
});
