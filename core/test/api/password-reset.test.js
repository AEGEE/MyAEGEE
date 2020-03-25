const { startServer, stopServer } = require('../../lib/server.js');
const { PasswordReset } = require('../../models');

const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Password reset', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the user is not found', async () => {
        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if no email is provided', async () => {
        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: {}
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work if the user is found', async () => {
        const user = await generator.createUser();

        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const resets = await PasswordReset.count({ where: { user_id: user.id } });
        expect(resets).not.toEqual(0);
    });

    test('should work if the user is found with email with spaces/tabs', async () => {
        const user = await generator.createUser();

        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: '\t\t\t   \t' + user.email + '\t     \t' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const resets = await PasswordReset.count({ where: { user_id: user.id } });
        expect(resets).not.toEqual(0);
    });
});
