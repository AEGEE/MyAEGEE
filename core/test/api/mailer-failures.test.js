const { startServer, stopServer } = require('../../lib/server');
const login = require('../../middlewares/login');
const joinRequests = require('../../middlewares/join-requests');
const config = require('../../config');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { startSilentServer } = require('../scripts/silent-server');
const Bugsnag = require('../../lib/bugsnag');
const logger = require('../../lib/logger');
const metrics = require('../../middlewares/metrics');
const {
    User,
    BodyMembership,
    CircleMembership,
    JoinRequest,
    MailChange,
    MailConfirmation,
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

    let notifySpy;
    let errorSpy;

    beforeEach(async () => {
        mock.mockAll({ mailer: { netError: true } });
        notifySpy = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
        errorSpy = jest.spyOn(logger, 'error');
    });

    afterEach(async () => {
        await login.waitForPasswordResets();
        notifySpy.mockRestore();
        errorSpy.mockRestore();
        mock.cleanAll();
        await generator.clearAll();
    });

    // The routes that roll back when their mail fails say so, and that trying again may work.
    const expectMailError = (res) => {
        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(MAIL_ERROR);
    };

    // A failure is logged with the template and the ids that are known, and no address, and
    // the error tracker gets the same fields.
    const expectReported = (message, fields) => {
        expect(errorSpy).toHaveBeenCalledWith({ err: expect.any(Error), ...fields }, message);

        expect(notifySpy).toHaveBeenCalledTimes(1);
        const [err, onError] = notifySpy.mock.calls[0];
        expect(err.template).toEqual(fields.template);
        const event = { addMetadata: jest.fn() };
        onError(event);
        expect(event.addMetadata).toHaveBeenCalledWith('mail', fields);
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
        expectReported('Could not send the confirmation of a signup', {
            template: 'confirm_email.html',
            user_id: expect.any(Number),
            campaign_id: campaign.id
        });
    });

    // The member is stored and committed before the confirmation is mailed. When the mail
    // fails, all of the signup is deleted again, so the same member can sign up once more.
    test('signing up leaves nothing behind, and the same member can sign up again', async () => {
        const body = await generator.createBody();
        const shadowCircle = await generator.createCircle({ body_id: body.id });
        await body.update({ shadow_circle_id: shadowCircle.id });
        const campaign = await generator.createCampaign({ active: true, autojoin_body_id: body.id });
        const member = generator.generateUser();
        const failuresBefore = (await metrics.signupMailFailures.get()).values[0].value;

        const res = await request({ path: '/signup/' + campaign.url, method: 'POST', body: member });

        expectMailError(res);
        expect(await User.count()).toEqual(0);
        expect(await MailConfirmation.count()).toEqual(0);
        expect(await BodyMembership.count()).toEqual(0);
        expect(await CircleMembership.count()).toEqual(0);
        expect((await metrics.signupMailFailures.get()).values[0].value).toEqual(failuresBefore + 1);
        expect(notifySpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ campaign_id: campaign.id, user_id: expect.any(Number), err: expect.any(Error) }),
            'Could not send the confirmation of a signup'
        );

        mock.cleanAll();
        mock.mockAll();
        const again = await request({ path: '/signup/' + campaign.url, method: 'POST', body: member });

        expect(again.statusCode).toEqual(200);
        expect(again.body.data.username).toEqual(member.username.toLowerCase());
        expect(await User.count()).toEqual(1);
        expect(await MailConfirmation.count()).toEqual(1);
        expect(await BodyMembership.count()).toEqual(1);
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
        expectReported('Could not send a mail', { template: 'mail_change.html', user_id: user.id, member_id: user.id });
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
        expectReported('Could not send a mail', { template: 'mail_change_notice.html' });
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
        expectReported('Could not send a password reset', {
            template: 'password_reset.html',
            user_id: user.id,
            password_reset_id: expect.any(Number)
        });
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
        expectReported('Could not send a mail', { template: 'new_member.html', user_id: admin.id, body_id: body.id });
    });

    // The mail to the board carries no token: the request is kept and the failure reported.
    test('requesting to join a body answers 200, keeps the request and reports the failure', async () => {
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

        await joinRequests.waitForBoardMails();
        expectReported('Could not tell the board about a join request', {
            template: 'member_joined.html',
            user_id: user.id,
            body_id: body.id,
            join_request_id: res.body.data.id
        });
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
        expectReported('Could not send a mail', {
            template: 'new_member.html',
            user_id: admin.id,
            body_id: body.id,
            join_request_id: joinRequest.id
        });
    });

    // The two removals tell the Workspace administrators after the membership is gone. That
    // notice is best effort: the removal answers as usual and the failure is logged.
    describe('removing a membership', () => {
        const expectReportedFailure = (userId) => expectReported(
            'Could not tell the Workspace administrators about a member without a body',
            { template: 'workspace_deleted_member.html', user_id: userId }
        );

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

        // The board is told about a join request after the answer.
        test('requesting to join a body answers before the mail to the board is sent', async () => {
            config.mailer.timeout = 5000;
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const body = await generator.createBody();

            const started = Date.now();
            const res = await request({
                path: '/bodies/' + body.id + '/join-requests',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { motivation: 'Motivation' }
            });
            const took = Date.now() - started;

            expect(res.statusCode).toEqual(200);
            expect(took).toBeLessThan(1000);

            await joinRequests.waitForBoardMails();
            expect(silentMailer.requests).toEqual(1);
            expect(await JoinRequest.count()).toEqual(1);
            expectReported('Could not tell the board about a join request', {
                template: 'member_joined.html',
                user_id: user.id,
                body_id: body.id,
                join_request_id: res.body.data.id
            });
        }, 20000);

        // A signup is stored and committed before its mail is sent, so a mailer that hangs
        // holds no database connection.
        test('signups do not hold up the requests of other members', async () => {
            config.mailer.timeout = 5000;
            const campaign = await generator.createCampaign({ active: true });
            const otherUser = await generator.createUser();
            const otherToken = await generator.createAccessToken(otherUser);

            const signups = Promise.all([1, 2, 3, 4, 5, 6].map(() => request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser()
            })));

            // Until all six signups wait for the mailer.
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

            const answers = await signups;
            expect(answers.map((answer) => answer.statusCode)).toEqual([503, 503, 503, 503, 503, 503]);
            expect(answers.map((answer) => answer.body)).toEqual(Array(6).fill(MAIL_ERROR));
            expect(await User.count()).toEqual(1);
        }, 20000);

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
