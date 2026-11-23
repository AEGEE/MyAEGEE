const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { BodyMembership, MailConfirmation, User } = require('../../models');
const constants = require('../../lib/constants');

describe('Campaign submission', () => {
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

    test('should fail if the campaign is not found', async () => {
        const user = generator.generateUser();

        const res = await request({
            path: '/signup/asdasdas',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the campaign is not active', async () => {
        const campaign = await generator.createCampaign({ active: false });
        const user = generator.generateUser();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the username is invalid', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ username: 'not valid username ' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should fail if the username has no letters', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ username: '123' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should fail if the first name is invalid', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ first_name: '!@#!@#D' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('first_name');
    });

    test('should fail if the last name is invalid', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ last_name: '!@#!@#D' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('last_name');
    });

    test('should fail if the email is not set', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ email: null });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
    });

    test('should fail if the email is in a subdomain of a restricted domain', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ email: 'test@sub.aegee.org' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
    });

    test('should succeed if the email only looks like a restricted domain', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ email: 'test@notaegee.org' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should refuse a password that is not a text', async () => {
        const campaign = await generator.createCampaign();

        for (const password of [12345678, 12345678901, 2147483648, 1e300]) {
            const res = await request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser({ password })
            });

            expect({ password, status: res.statusCode, fields: Object.keys(res.body.errors || {}) })
                .toEqual({ password, status: 422, fields: ['password'] });
            expect(res.body.errors.password).toContain('Password should be a text.');
        }

        expect(await User.count()).toEqual(0);
    });

    test('should fail if the password is not set', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ password: null });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('password');
    });

    test('should fail if the username is not set', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ username: null });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should sign the member up with the personal email as primary email, whatever is sent', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser({ primary_email: 'gsuite' });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const userFromDb = await User.findByPk(res.body.data.id);
        expect(userFromDb.primary_email).toEqual('personal');
        expect(userFromDb.notification_email).toEqual(userFromDb.email);
    });

    test('should succeed when everything is okay', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should create a body membership if autojoin_body_id is provided', async () => {
        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });
        const user = generator.generateUser();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const membershipFromDb = await BodyMembership.findOne({
            where: {
                body_id: body.id,
                user_id: res.body.data.id
            }
        });

        expect(membershipFromDb).not.toEqual(null);
    });

    test('should remove extra fields', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser({ superadmin: true });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.superadmin).toEqual(false);
    });

    test('should send a mail to user', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser();

        const requestsMock = mock.mockAll({
            mailer: {
                body: (body) => body.to === user.email.toLowerCase()
            }
        });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(requestsMock.mailer.isDone()).toEqual(true);
    });

    test('should answer 503 and create nobody when the mail cannot be sent', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const campaign = await generator.createCampaign({});
        const user = generator.generateUser();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(503);
        expect(res.body.message).toEqual('The mail could not be sent, so nothing was saved. Please try again later.');
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should answer with the new member as stored, without the password', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser({
            email: 'New.Member@Example.com',
            password: 'a-secret-password',
            superadmin: true,
            active: false,
            mail_confirmed_at: new Date()
        });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).not.toHaveProperty('password');
        expect(JSON.stringify(res.body)).not.toContain('a-secret-password');

        const userFromDb = await User.scope('withPassword').findOne({ where: { email: 'new.member@example.com' } });
        expect(JSON.stringify(res.body)).not.toContain(userFromDb.password);

        // What a member can't choose is not taken from the request.
        expect(res.body.data).toEqual(expect.objectContaining({
            id: userFromDb.id,
            email: 'new.member@example.com',
            notification_email: 'new.member@example.com',
            superadmin: false,
            active: true,
            mail_confirmed_at: null,
            campaign_id: campaign.id
        }));
    });

    describe('an email or username that is taken', () => {
        const signUp = async (fields) => {
            const campaign = await generator.createCampaign({});
            const mails = mock.captureMails();

            const res = await request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser(fields)
            });

            return { res, mails };
        };

        test.each([
            ['the same', 'taken@example.com'],
            ['in another case', 'Taken@Example.COM'],
            ['with spaces around it', '  taken@example.com  ']
        ])('should fail if the email is taken (%s)', async (name, email) => {
            const existing = await generator.createUser({ email: 'taken@example.com' });

            const { res, mails } = await signUp({ email });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { email: ['email must be unique'] } });

            const users = await User.findAll();
            expect(users.map((user) => user.id)).toEqual([existing.id]);
            expect(await MailConfirmation.count()).toEqual(0);
            expect(mails).toEqual([]);
        });

        test.each([
            ['the same', 'john'],
            ['in another case', 'John'],
            ['with spaces around it', ' john ']
        ])('should fail if the username is taken (%s)', async (name, username) => {
            const existing = await generator.createUser({ username: 'john' });

            const { res, mails } = await signUp({ username });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { username: ['username must be unique'] } });

            const users = await User.findAll();
            expect(users.map((user) => user.id)).toEqual([existing.id]);
            expect(await MailConfirmation.count()).toEqual(0);
            expect(mails).toEqual([]);
        });

        test('should not take the email of one member as the username of another', async () => {
            await generator.createUser({ username: 'john', email: 'john@example.com' });

            const { res } = await signUp({ username: 'jane', email: 'john.other@example.com' });

            expect(res.statusCode).toEqual(200);
            expect(await User.count()).toEqual(2);
        });
    });

    test.each([
        ['has no domain', 'not-an-email'],
        ['has no name', '@example.com'],
        ['has a space in it', 'some one@example.com']
    ])('should fail if the email %s', async (name, email) => {
        const campaign = await generator.createCampaign({});
        const mails = mock.captureMails();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: generator.generateUser({ email })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, errors: { email: ['Email should be valid.'] } });

        expect(await User.count()).toEqual(0);
        expect(mails).toEqual([]);
    });

    test('should name every field that is not valid, and store nothing', async () => {
        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });
        const mails = mock.captureMails();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: generator.generateUser({ username: '1234', email: 'not-an-email', password: 'short', first_name: '!@#' })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({
            success: false,
            errors: {
                username: ['Username should have at least 1 letter.'],
                email: ['Email should be valid.'],
                password: ['Password should be at least 8 characters long.'],
                first_name: ['First name should only contain letters, spaces and dashes, got "!@#".']
            }
        });

        expect(await User.count()).toEqual(0);
        expect(await BodyMembership.count()).toEqual(0);
        expect(await MailConfirmation.count()).toEqual(0);
        expect(mails).toEqual([]);
    });

    test('should mail the confirmation token to the new member', async () => {
        const campaign = await generator.createCampaign({});
        const mails = mock.captureMails();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: generator.generateUser({ first_name: ' Some ', last_name: 'One', email: 'Some.One@Example.com' })
        });

        expect(res.statusCode).toEqual(200);

        const confirmations = await MailConfirmation.findAll();
        expect(confirmations.length).toEqual(1);
        expect(confirmations[0].user_id).toEqual(res.body.data.id);
        expect(confirmations[0].value.length).toEqual(constants.TOKEN_LENGTH.MAIL_CONFIRMATION);
        expect(confirmations[0].is_expired).toEqual(false);

        // What the mailer gets: the member's address and name as stored, and the token of the confirmation.
        expect(mails).toEqual([{
            to: 'some.one@example.com',
            subject: constants.MAIL_SUBJECTS.MAIL_CONFIRMATION,
            template: 'confirm_email.html',
            parameters: {
                name: 'Some',
                surname: 'One',
                token: confirmations[0].value
            }
        }]);

        // The token is only in the mail.
        expect(JSON.stringify(res.body)).not.toContain(confirmations[0].value);
    });

    test('should let the new member confirm with the token from the mail, and log in after that', async () => {
        const campaign = await generator.createCampaign({});
        const mails = mock.captureMails();
        const user = generator.generateUser({ password: 'a-secret-password' });

        await request({ path: '/signup/' + campaign.url, method: 'POST', body: user });

        const login = () => request({
            path: '/login',
            method: 'POST',
            body: { username: user.email, password: 'a-secret-password' }
        });

        const before = await login();
        expect(before.statusCode).toEqual(403);
        expect(before.body.message).toEqual('Please confirm your mail first.');

        const confirmed = await request({
            path: '/confirm-email',
            method: 'POST',
            body: { token: mails[0].parameters.token }
        });
        expect(confirmed.statusCode).toEqual(200);

        const after = await login();
        expect(after.statusCode).toEqual(200);
    });

    test('should not find a campaign by its id', async () => {
        const campaign = await generator.createCampaign({});

        const res = await request({
            path: '/signup/' + campaign.id,
            method: 'POST',
            body: generator.generateUser()
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'Campaign is not found.' });
        expect(await User.count()).toEqual(0);
    });

    test('should store nobody and send nothing if the campaign is not active', async () => {
        const campaign = await generator.createCampaign({ active: false });
        const mails = mock.captureMails();

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: generator.generateUser()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Campaign is not active.' });
        expect(await User.count()).toEqual(0);
        expect(mails).toEqual([]);
    });
});
