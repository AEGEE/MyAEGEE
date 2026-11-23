const nock = require('nock');

const { startServer, stopServer } = require('../../lib/server');
const { PasswordReset, User } = require('../../models');

const { request: sendRequest } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const login = require('../../middlewares/login');
const config = require('../../config');
const Bugsnag = require('../../lib/bugsnag');
const constants = require('../../lib/constants');

// The reset is created and mailed after the answer. The tests look at the result, so they wait for that.
const request = async (options) => {
    const res = await sendRequest(options);
    await login.waitForPasswordResets();
    return res;
};

// The value of the counter on /metrics, which is where Prometheus reads it.
const countFailures = async () => {
    const res = await sendRequest({ path: '/metrics', method: 'GET', responseType: 'text' });
    const line = res.body.split('\n').find((metric) => metric.startsWith('core_password_reset_failures_total '));

    return line ? Number(line.split(' ')[1]) : null;
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

    test('should answer the same and send nothing for a suspended member', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser({ active: false });

        const unknown = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: 'test@test.io' }
        });

        const res = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(unknown.body);

        expect(await PasswordReset.count()).toEqual(0);
        expect(mails.length).toEqual(0);
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

    test('should fail if the email is not a string', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser();

        for (const email of [{ address: user.email }, [user.email], 42, true]) {
            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Email should be a string.');
        }

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

    // A reset ends the earlier ones only once its own mail went out, so a reset whose mail
    // fails leaves the link that was mailed before working.
    describe('two resets of which one cannot be mailed', () => {
        const requestReset = (user) => request({ path: '/password_reset', method: 'POST', body: { email: user.email } });
        const confirm = (token) => sendRequest({ path: '/password_confirm', method: 'POST', body: { token, password: 'a-new-password' } });

        test('should keep the reset that was mailed when the later one fails', async () => {
            const user = await generator.createUser();

            await requestReset(user);
            const [mailed] = await PasswordReset.findAll({ where: { user_id: user.id } });

            mock.cleanAll();
            mock.mockAll({ mailer: { netError: true } });
            await requestReset(user);

            const resets = await PasswordReset.findAll({ where: { user_id: user.id } });
            expect(resets.map((reset) => reset.id)).toEqual([mailed.id]);
            expect((await confirm(mailed.value)).statusCode).toEqual(200);
        });

        test('should keep the reset that was mailed when the earlier one failed', async () => {
            const user = await generator.createUser();

            mock.cleanAll();
            mock.mockAll({ mailer: { netError: true } });
            await requestReset(user);
            expect(await PasswordReset.count()).toEqual(0);

            mock.cleanAll();
            mock.mockAll();
            await requestReset(user);

            const resets = await PasswordReset.findAll({ where: { user_id: user.id } });
            expect(resets.length).toEqual(1);
            expect((await confirm(resets[0].value)).statusCode).toEqual(200);
        });

        test('should end the earlier reset when the later one is mailed', async () => {
            const user = await generator.createUser();

            await requestReset(user);
            const [first] = await PasswordReset.findAll({ where: { user_id: user.id } });
            await requestReset(user);

            const resets = await PasswordReset.findAll({ where: { user_id: user.id } });
            expect(resets.length).toEqual(1);
            expect(resets[0].id).not.toEqual(first.id);
            expect((await confirm(first.value)).statusCode).toEqual(404);
            expect((await confirm(resets[0].value)).statusCode).toEqual(200);
        });

        test('should keep the reset that was mailed when the earlier ones cannot be ended', async () => {
            const user = await generator.createUser();
            const earlier = await generator.createPasswordReset(user);
            const destroySpy = jest.spyOn(PasswordReset, 'destroy').mockRejectedValueOnce(new Error('Database is gone'));
            const notifySpy = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
            const failuresBefore = await countFailures();
            try {
                await requestReset(user);

                const resets = await PasswordReset.findAll({ where: { user_id: user.id }, order: [['id', 'ASC']] });
                expect(resets.map((reset) => reset.id)).toEqual([earlier.id, expect.any(Number)]);
                expect(resets[1].id).toBeGreaterThan(earlier.id);
                expect(notifySpy).toHaveBeenCalledTimes(1);
                expect(await countFailures()).toEqual(failuresBefore);
            } finally {
                destroySpy.mockRestore();
                notifySpy.mockRestore();
            }
        });
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

    test('should report and count a reset that cannot be mailed', async () => {
        const notifySpy = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});

        try {
            const failuresBefore = await countFailures();

            mock.mockAll({ mailer: { netError: true } });
            const user = await generator.createUser();

            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: user.email }
            });

            expect(res.statusCode).toEqual(200);
            expect(notifySpy).toHaveBeenCalledTimes(1);
            expect(notifySpy.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(await countFailures()).toEqual(failuresBefore + 1);
        } finally {
            notifySpy.mockRestore();
        }
    });

    test('should not report or count a request for an address without an account', async () => {
        const notifySpy = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});

        try {
            const failuresBefore = await countFailures();

            mock.mockAll({ mailer: { netError: true } });

            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: 'test@test.io' }
            });

            expect(res.statusCode).toEqual(200);
            expect(notifySpy).not.toHaveBeenCalled();
            expect(await countFailures()).toEqual(failuresBefore);
        } finally {
            notifySpy.mockRestore();
        }
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

    describe('the mail', () => {
        test('should carry the token of the stored reset, and nothing else', async () => {
            const mails = mock.captureMails();
            const user = await generator.createUser({ email: 'some.one@example.com' });

            const before = Date.now();
            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: 'some.one@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: 'If this email belongs to an account, a password reset was sent to it.'
            });

            const resets = await PasswordReset.findAll();
            expect(resets.length).toEqual(1);
            expect(resets[0].user_id).toEqual(user.id);
            expect(resets[0].value.length).toEqual(constants.TOKEN_LENGTH.PASSWORD_RESET);
            expect(resets[0].expires_at.getTime()).toBeGreaterThanOrEqual(before + ((config.ttl.password_reset - 1) * 1000));
            expect(resets[0].expires_at.getTime()).toBeLessThanOrEqual(Date.now() + (config.ttl.password_reset * 1000));

            expect(mails).toEqual([{
                to: 'some.one@example.com',
                subject: constants.MAIL_SUBJECTS.PASSWORD_RESET,
                template: 'password_reset.html',
                parameters: { token: resets[0].value }
            }]);
        });

        test('should go to the login email of a member whose primary email is the Google Workspace account', async () => {
            const mails = mock.captureMails();
            await generator.createUser({
                email: 'some.one@example.com',
                gsuite_id: 'some.one@aegee.eu',
                primary_email: 'gsuite'
            });

            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: 'some.one@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(mails.length).toEqual(1);
            expect(mails[0].to).toEqual('some.one@example.com');
        });

        test('should not be sent for the Google Workspace account or the username of a member', async () => {
            const mails = mock.captureMails();
            await generator.createUser({
                username: 'someone',
                email: 'some.one@example.com',
                gsuite_id: 'some.one@aegee.eu',
                primary_email: 'gsuite'
            });

            for (const email of ['some.one@aegee.eu', 'someone']) {
                const res = await request({
                    path: '/password_reset',
                    method: 'POST',
                    body: { email }
                });

                expect(res.statusCode).toEqual(200);
            }

            expect(mails).toEqual([]);
            expect(await PasswordReset.count()).toEqual(0);
        });

        test('should let the member set a new password with its token', async () => {
            const mails = mock.captureMails();
            const user = await generator.createUser({ password: 'the-old-password' });

            await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: user.email }
            });

            const confirmed = await request({
                path: '/password_confirm',
                method: 'POST',
                body: { token: mails[0].parameters.token, password: 'the-new-password' }
            });
            expect(confirmed.statusCode).toEqual(200);

            const userFromDb = await User.scope('withPassword').findByPk(user.id);
            expect(await userFromDb.checkPassword('the-new-password')).toEqual(true);
            expect(await userFromDb.checkPassword('the-old-password')).toEqual(false);
        });

        test('should only keep the token of the last request of a member', async () => {
            const mails = mock.captureMails();
            const user = await generator.createUser({ password: 'the-old-password' });

            for (let i = 0; i < 2; i++) {
                await request({
                    path: '/password_reset',
                    method: 'POST',
                    body: { email: user.email }
                });
            }

            expect(mails.length).toEqual(2);
            expect(mails[0].parameters.token).not.toEqual(mails[1].parameters.token);

            const resets = await PasswordReset.findAll();
            expect(resets.map((reset) => reset.value)).toEqual([mails[1].parameters.token]);

            const withFirstToken = await request({
                path: '/password_confirm',
                method: 'POST',
                body: { token: mails[0].parameters.token, password: 'the-new-password' }
            });
            expect(withFirstToken.statusCode).toEqual(404);

            const userFromDb = await User.scope('withPassword').findByPk(user.id);
            expect(await userFromDb.checkPassword('the-old-password')).toEqual(true);
        });

        test('should not touch the resets of other members', async () => {
            mock.captureMails();
            const user = await generator.createUser();
            const otherUser = await generator.createUser();
            const otherReset = await generator.createPasswordReset(otherUser);

            await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: user.email }
            });

            const resets = await PasswordReset.findAll({ order: [['id', 'ASC']] });
            expect(resets.map((reset) => reset.user_id)).toEqual([otherUser.id, user.id]);
            expect(resets[0].value).toEqual(otherReset.value);
        });
    });
});
