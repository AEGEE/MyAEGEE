const { startServer, stopServer } = require('../../lib/server');
const login = require('../../middlewares/login');
const config = require('../../config');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { startSilentServer } = require('../scripts/silent-server');
const Bugsnag = require('../../lib/bugsnag');
const logger = require('../../lib/logger');
const {
    User,
    BodyMembership,
    JoinRequest,
    MailChange,
    PasswordReset
} = require('../../models');

const MAIL_ERROR = { success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' };

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

    // The routes that roll back when their mail fails say so, and that trying again may work.
    const expectMailError = (res) => {
        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(MAIL_ERROR);
    };

    test('signing up answers 503 and creates no member', async () => {
        const campaign = await generator.createCampaign({ active: true });

        const res = await request({
            path: '/signup/' + campaign.url,
            method: 'POST',
            body: generator.generateUser()
        });

        expectMailError(res);
        expect(await User.count()).toEqual(0);
    });

    test('requesting an email change answers 503 and keeps no request', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'new@example.com' }
        });

        expectMailError(res);
        expect(await MailChange.count()).toEqual(0);
    });

    test('confirming an email change answers 503 and changes nothing', async () => {
        const user = await generator.createUser({ email: 'current@example.com' });
        const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });

        const res = await request({
            path: '/confirm-email-change',
            method: 'POST',
            body: { token: mailChange.value }
        });

        expectMailError(res);
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

    test('adding a member to their first body answers 503 and adds nobody', async () => {
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

        expectMailError(res);
        expect(await BodyMembership.count()).toEqual(0);
    });

    // The mail to the board carries no token: the request is kept and the failure reported.
    test('requesting to join a body answers 200, keeps the request and reports the failure', async () => {
        const notifySpy = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
        const errorSpy = jest.spyOn(logger, 'error');
        try {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const body = await generator.createBody();

            const res = await request({
                path: '/bodies/' + body.id + '/join-requests',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { motivation: 'Motivation' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.user_id).toEqual(user.id);
            expect(await JoinRequest.count()).toEqual(1);
            expect(notifySpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledWith(
                expect.objectContaining({ body_id: body.id, err: expect.any(Error) }),
                'Could not tell the board about a join request'
            );
        } finally {
            notifySpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    test('approving a join request answers 503 and leaves it pending', async () => {
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

        expectMailError(res);
        expect((await JoinRequest.findByPk(joinRequest.id)).status).toEqual('pending');
        expect(await BodyMembership.count()).toEqual(0);
    });

    // The two removals tell the Workspace administrators after the membership is gone. That
    // notice is best effort: the removal answers as usual and the failure is logged.
    describe('removing a membership', () => {
        let notifySpy;
        let errorSpy;

        beforeEach(() => {
            notifySpy = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
            errorSpy = jest.spyOn(logger, 'error');
        });

        afterEach(() => {
            notifySpy.mockRestore();
            errorSpy.mockRestore();
        });

        const expectReportedFailure = (userId) => {
            expect(notifySpy).toHaveBeenCalledTimes(1);
            expect(notifySpy.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(errorSpy).toHaveBeenCalledWith(
                expect.objectContaining({ user_id: userId, err: expect.any(Error) }),
                'Could not tell the Workspace administrators about a member without a body'
            );
        };

        test('removing a member from their last body answers 200 and reports the failure', async () => {
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

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'Membership is deleted' });
            expect(await BodyMembership.count()).toEqual(0);
            expectReportedFailure(member.id);
        });

        test('leaving the last body answers 200 and reports the failure', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const body = await generator.createBody();
            await generator.createBodyMembership(body, user);

            const res = await request({
                path: '/bodies/' + body.id + '/members',
                method: 'DELETE',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'Membership is deleted.' });
            expect(await BodyMembership.count()).toEqual(0);
            expectReportedFailure(user.id);
        });
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

        test('signing up answers 503 and creates no member', async () => {
            const campaign = await generator.createCampaign({ active: true });

            const res = await request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser()
            });

            expectMailError(res);
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

        // A reset is stored and committed before its mail is sent, so a mailer that hangs
        // holds no database connection and no lock.
        test('password resets do not hold up the requests of other members', async () => {
            config.mailer.timeout = 5000;
            const user = await generator.createUser();
            const otherUser = await generator.createUser();
            const otherToken = await generator.createAccessToken(otherUser);

            const resets = await Promise.all([1, 2, 3, 4, 5, 6].map(() => request({
                path: '/password_reset',
                method: 'POST',
                body: { email: user.email }
            })));
            expect(resets.map((res) => res.statusCode)).toEqual([200, 200, 200, 200, 200, 200]);

            // Until all six resets wait for the mailer.
            for (let i = 0; i < 100 && silentMailer.requests < 6; i++) {
                await new Promise((resolve) => { setTimeout(resolve, 20); });
            }

            const started = Date.now();
            const res = await request({
                path: '/members/me',
                headers: { 'X-Auth-Token': otherToken.value }
            });
            const took = Date.now() - started;

            expect(res.statusCode).toEqual(200);
            expect(silentMailer.requests).toEqual(6);
            expect(took).toBeLessThan(1000);

            await login.waitForPasswordResets();
            expect(await PasswordReset.count()).toEqual(0);
        }, 20000);
    });
});
