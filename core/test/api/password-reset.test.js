const nock = require('nock');

const { startServer, stopServer } = require('../../lib/server');
const { PasswordReset, User } = require('../../models');

const { request: sendRequest } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const login = require('../../middlewares/login');
const config = require('../../config');

// The reset is created and mailed after the answer. The tests look at the result, so they wait for that.
const request = async (options) => {
    const res = await sendRequest(options);
    await login.waitForPasswordResets();
    return res;
};

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

    test('should answer the same whether or not the address belongs to an account', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser();

        const known = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        const unknown = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: 'test@test.io' }
        });

        expect(known.statusCode).toEqual(200);
        expect(unknown.statusCode).toEqual(200);
        expect(unknown.body.success).toEqual(true);
        expect(unknown.body).toHaveProperty('message');
        expect(unknown.body).toEqual(known.body);

        // Only the account got a reset and a mail.
        const resets = await PasswordReset.findAll();
        expect(resets.length).toEqual(1);
        expect(resets[0].user_id).toEqual(user.id);

        expect(mails.length).toEqual(1);
        expect(mails[0].to).toEqual(user.email);
    });

    test('should answer the same and send nothing if no email is provided', async () => {
        const mails = mock.captureMails();
        await generator.createUser();

        const unknown = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: 'test@test.io' }
        });

        const res = await request({
            path: '/password_reset',
            method: 'POST',
            body: {}
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(unknown.body);

        expect(await PasswordReset.count()).toEqual(0);
        expect(mails.length).toEqual(0);
    });

    test('should not treat _ and % as wildcards', async () => {
        const mails = mock.captureMails();
        await generator.createUser({ email: 'a_b@example.com' });
        await generator.createUser({ email: 'axb@example.org' });

        for (const email of ['axb@example.com', 'a_b@example.org', '%', '%@example.com']) {
            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email }
            });

            expect(res.statusCode).toEqual(200);
        }

        expect(await PasswordReset.count()).toEqual(0);
        expect(mails.length).toEqual(0);
    });

    test('should find an email that was saved with uppercase letters', async () => {
        const mails = mock.captureMails();

        // An address from before emails were saved in lowercase.
        const user = await User.create(generator.generateUser({ email: 'Mixed.Case@Example.com' }), { validate: false });

        const res = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: 'mixed.case@example.com' }
        });

        expect(res.statusCode).toEqual(200);
        expect(await PasswordReset.count({ where: { user_id: user.id } })).toEqual(1);
        expect(mails.length).toEqual(1);
        expect(mails[0].to).toEqual('Mixed.Case@Example.com');
    });

    test('should work if the user is found', async () => {
        const user = await generator.createUser();

        const res = await request({
            path: '/password_reset',
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
            path: '/password_reset',
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
            path: '/password_reset',
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
            path: '/password_reset',
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
            path: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        expect(requestsMock.mailer.isDone()).toEqual(true);
    });

    test('should answer the same if the mail cannot be sent', async () => {
        const unknown = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: 'test@test.io' }
        });

        mock.mockAll({ mailer: { netError: true } });
        const user = await generator.createUser();

        const res = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(unknown.body);

        // A reset nobody got a mail for is not kept.
        expect(await PasswordReset.count()).toEqual(0);
    });

    test('should answer before the mail is sent', async () => {
        nock.cleanAll();

        const mails = [];
        nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/')
            .delay(300)
            .reply(200, (uri, body) => {
                mails.push(body);
                return { success: true };
            });

        const user = await generator.createUser();

        const res = await sendRequest({
            path: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(mails.length).toEqual(0);

        await login.waitForPasswordResets();

        expect(mails.length).toEqual(1);
        expect(mails[0].to).toEqual(user.email);
        expect(await PasswordReset.count({ where: { user_id: user.id } })).toEqual(1);
    });

    test('should find an email with a dollar sign', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser({ email: 'some$one@example.com' });

        const res = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: 'some$one@example.com' }
        });

        expect(res.statusCode).toEqual(200);
        expect(await PasswordReset.count({ where: { user_id: user.id } })).toEqual(1);
        expect(mails.length).toEqual(1);
    });
});
