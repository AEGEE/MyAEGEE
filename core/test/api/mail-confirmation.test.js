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
            path: '/confirm-email',
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
            path: '/confirm-email',
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
            path: '/confirm-email',
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
            path: '/confirm-email',
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

    test.each([
        ['a number', 5],
        ['a list', ['a']],
        ['an object', { a: 1 }],
        ['a boolean', true]
    ])('should answer 400 if the token is %s', async (name, value) => {
        const res = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'No token specified.' });
    });

    test('should say what is wrong with the token', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const expired = await generator.createMailConfirmation(user, { expires_at: moment().subtract(1, 'minute').toDate() });

        const unknownRes = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: 'does-not-exist' }
        });
        expect(unknownRes.statusCode).toEqual(404);
        expect(unknownRes.body).toEqual({ success: false, message: 'The token is invalid.' });

        const expiredRes = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: expired.value }
        });
        expect(expiredRes.statusCode).toEqual(403);
        expect(expiredRes.body).toEqual({ success: false, message: 'The token has expired.' });
    });

    test('should keep the member unconfirmed and the confirmation if it is expired', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const confirmation = await generator.createMailConfirmation(user, { expires_at: moment().subtract(1, 'day').toDate() });

        const res = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: confirmation.value }
        });

        expect(res.statusCode).toEqual(403);

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.mail_confirmed_at).toBeNull();
        expect(await MailConfirmation.count({ where: { user_id: user.id } })).toEqual(1);
    });

    test('should confirm the member of the token, and nobody else', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const confirmation = await generator.createMailConfirmation(user);
        const otherUser = await generator.createUser({ mail_confirmed_at: null });
        const otherConfirmation = await generator.createMailConfirmation(otherUser);

        const before = Date.now();
        const res = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: confirmation.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'Your profile is activated.' });

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.mail_confirmed_at.getTime()).toBeGreaterThanOrEqual(before - 1000);

        const otherFromDb = await User.findByPk(otherUser.id);
        expect(otherFromDb.mail_confirmed_at).toBeNull();

        const confirmations = await MailConfirmation.findAll();
        expect(confirmations.map((item) => item.id)).toEqual([otherConfirmation.id]);
    });

    test('should accept a token only once', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const confirmation = await generator.createMailConfirmation(user);
        const confirm = () => request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: confirmation.value }
        });

        expect((await confirm()).statusCode).toEqual(200);

        const res = await confirm();
        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'The token is invalid.' });
    });

    test('should let the member log in after the confirmation', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null, password: 'testtest' });
        const confirmation = await generator.createMailConfirmation(user);
        const login = () => request({
            path: '/login',
            method: 'POST',
            body: { username: user.email, password: 'testtest' }
        });

        expect((await login()).statusCode).toEqual(403);

        await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: confirmation.value }
        });

        expect((await login()).statusCode).toEqual(200);
    });

    test('should not take the token of an email change', async () => {
        const user = await generator.createUser({ mail_confirmed_at: null });
        const mailChange = await generator.createMailChange(user);

        const res = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: mailChange.value }
        });

        expect(res.statusCode).toEqual(404);

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.mail_confirmed_at).toBeNull();
    });
});
