const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User, MailConfirmation } = require('../../models');

describe('Mail confirmation', () => {
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
            uri: '/confirm-email',
            method: 'POST',
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the confirmation is not found', async () => {
        const res = await request({
            uri: '/confirm-email',
            method: 'POST',
            body: { token: 'test' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the confirmation is expired', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const confirmation = await generator.createMailConfirmation(user, { expires_at: moment().subtract(1, 'day').toDate() });

        const res = await request({
            uri: '/confirm-email',
            method: 'POST',
            body: { token: confirmation.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const confirmation = await generator.createMailConfirmation(user, { expires_at: moment().add(1, 'day').toDate() });

        const res = await request({
            uri: '/confirm-email',
            method: 'POST',
            body: { token: confirmation.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('errors');

        const confirmationFromDb = await MailConfirmation.findByPk(confirmation.id);
        expect(confirmationFromDb).toEqual(null);

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.mail_confirmed_at).not.toEqual(null);
    });
});
