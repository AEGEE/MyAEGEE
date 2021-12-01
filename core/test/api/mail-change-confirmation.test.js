const { startServer, stopServer } = require('../../lib/server');
const { MailChange, User } = require('../../models');

const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Mail change confirm', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the mail change is not found', async () => {
        const res = await request({
            uri: '/confirm-email-change',
            method: 'POST',
            body: { token: '1' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if no token is provided', async () => {
        const res = await request({
            uri: '/confirm-email-change',
            method: 'POST',
            body: {}
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if token is expired', async () => {
        const user = await generator.createUser();
        const mailChange = await generator.createMailChange(user, { expires_at: new Date() });

        const res = await request({
            uri: '/confirm-email-change',
            method: 'POST',
            body: { token: mailChange.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should work if the token is found', async () => {
        const user = await generator.createUser();
        const mailChange = await generator.createMailChange(user);

        const res = await request({
            uri: '/confirm-email-change',
            method: 'POST',
            body: { token: mailChange.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const mailChanges = await MailChange.count({ where: { user_id: user.id } });
        expect(mailChanges).toEqual(0);

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(userFromDb.email).toEqual(mailChange.new_email);
    });

    test('should work if the token is found with email with spaces/tabs', async () => {
        const user = await generator.createUser();
        const mailChange = await generator.createMailChange(user);

        const res = await request({
            uri: '/confirm-email-change',
            method: 'POST',
            body: { token: '\t\t\t   \t' + mailChange.value + '\t     \t' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });
});
