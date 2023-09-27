const { startServer, stopServer } = require('../../lib/server');
const { PasswordReset } = require('../../models');

const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

describe('Password reset', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
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

    test('should work if the user is found with email with uppercase', async () => {
        const user = await generator.createUser();

        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: user.email.toUpperCase() }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const resets = await PasswordReset.count({ where: { user_id: user.id } });
        expect(resets).not.toEqual(0);
    });

    test('should remove all other password resets', async () => {
        const user = await generator.createUser();
        const existingReset = await generator.createPasswordReset(user);

        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const resets = await PasswordReset.findAll({ where: { user_id: user.id } });
        expect(resets.length).toEqual(1);
        expect(resets[0].id).not.toEqual(existingReset.id);
    });

    test('should send the mail to a user', async () => {
        const user = await generator.createUser();

        const requestsMock = mock.mockAll({
            mailer: {
                body: (body) => body.to === user.email.toLowerCase()
            }
        });

        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        expect(requestsMock.mailer.isDone()).toEqual(true);
    });

    test('should fail if mailer fails', async () => {
        mock.mockAll({ mailer: { netError: true } });
        const user = await generator.createUser();

        const res = await request({
            uri: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
