const { startServer, stopServer } = require('../../lib/server');
const login = require('../../middlewares/login');
const config = require('../../config');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { startSilentServer } = require('../scripts/silent-server');
const {
    User,
    BodyMembership,
    JoinRequest,
    MailChange,
    PasswordReset
} = require('../../models');

const SERVER_ERROR = { success: false, message: 'Something went wrong on the server.' };

// What each route that sends a mail does when the mailer fails. A mailer that takes longer
// than the timeout fails like any other mailer error, so the routes are tested with a mailer
// that answers with an error, and two of them with one that does not answer at all.
describe('A mailer that fails', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mailer: { netError: true } });
    });

    afterEach(async () => {
        await login.waitForPasswordResets();
        mock.cleanAll();
        await generator.clearAll();
    });

    const expectServerError = (res) => {
        expect(res.statusCode).toEqual(500);
        expect(res.body).toEqual(SERVER_ERROR);
    };

    test('signing up answers 500 and creates no member', async () => {
        const campaign = await generator.createCampaign({ active: true });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: generator.generateUser()
        });

        expectServerError(res);
        expect(await User.count()).toEqual(0);
    });

    test('requesting an email change answers 500 and keeps no request', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'new@example.com' }
        });

        expectServerError(res);
        expect(await MailChange.count()).toEqual(0);
    });

    test('confirming an email change answers 500 and changes nothing', async () => {
        const user = await generator.createUser({ email: 'current@example.com' });
        const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });

        const res = await request({
            path: '/confirm-email-change',
            method: 'POST',
            body: { token: mailChange.value }
        });

        expectServerError(res);
        expect((await User.findByPk(user.id)).email).toEqual('current@example.com');
        expect(await MailChange.count()).toEqual(1);
    });

    test('requesting a password reset answers as always and keeps no reset', async () => {
        const user = await generator.createUser();

        const res = await request({
            path: '/password_reset',
            method: 'POST',
            body: { email: user.email }
        });

        expect(res.statusCode).toEqual(200);

        await login.waitForPasswordResets();
        expect(await PasswordReset.count()).toEqual(0);
    });

    test('adding a member to their first body answers 500 and adds nobody', async () => {
        const admin = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(admin);
        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });
        const body = await generator.createBody();
        const member = await generator.createUser();

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: member.id }
        });

        expectServerError(res);
        expect(await BodyMembership.count()).toEqual(0);
    });

    test('requesting to join a body answers 500 and keeps no request', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'Motivation' }
        });

        expectServerError(res);
        expect(await JoinRequest.count()).toEqual(0);
    });

    test('approving a join request answers 500 and leaves it pending', async () => {
        const admin = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(admin);
        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });
        const body = await generator.createBody();
        const applicant = await generator.createUser();
        const joinRequest = await generator.createJoinRequest(body, applicant);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expectServerError(res);
        expect((await JoinRequest.findByPk(joinRequest.id)).status).toEqual('pending');
        expect(await BodyMembership.count()).toEqual(0);
    });

    // The two removals tell the Workspace administrators after the membership is gone:
    // the request reports the failure, the removal stays.
    test('removing a member from their last body answers 500 after the removal', async () => {
        const admin = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(admin);
        await generator.createPermission({ scope: 'global', action: 'delete_member', object: 'body' });
        const body = await generator.createBody();
        const member = await generator.createUser();
        const membership = await generator.createBodyMembership(body, member);

        const res = await request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expectServerError(res);
        expect(await BodyMembership.count()).toEqual(0);
    });

    test('leaving the last body answers 500 after the member has left', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expectServerError(res);
        expect(await BodyMembership.count()).toEqual(0);
    });

    describe('by not answering within the timeout', () => {
        const original = { ...config.mailer };
        let silentMailer;

        beforeEach(async () => {
            mock.cleanAll();
            silentMailer = await startSilentServer();
            config.mailer.url = 'http://127.0.0.1';
            config.mailer.port = silentMailer.port;
            config.mailer.timeout = 1000;
        });

        afterEach(async () => {
            await login.waitForPasswordResets();
            Object.assign(config.mailer, original);
            await silentMailer.close();
        });

        test('signing up answers 500 and creates no member', async () => {
            const campaign = await generator.createCampaign({ active: true });

            const res = await request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser()
            });

            expectServerError(res);
            expect(silentMailer.requests).toEqual(1);
            expect(await User.count()).toEqual(0);
        });

        test('requesting a password reset answers as always and keeps no reset', async () => {
            const user = await generator.createUser();

            const res = await request({
                path: '/password_reset',
                method: 'POST',
                body: { email: user.email }
            });

            expect(res.statusCode).toEqual(200);

            await login.waitForPasswordResets();
            expect(silentMailer.requests).toEqual(1);
            expect(await PasswordReset.count()).toEqual(0);
        });
    });
});
