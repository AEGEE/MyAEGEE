const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { AccessToken, RefreshToken } = require('../../models');

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
            uri: '/renew',
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

        const accessToken = await AccessToken.findOne({
            where: { value: res.body.access_token }
        });

        const refreshTokenFromDb = await RefreshToken.findOne({
            where: { value: refreshToken.value }
        });

        expect(accessToken.user_id).toEqual(user.id);
        expect(refreshTokenFromDb.user_id).toEqual(user.id);
    });
});
