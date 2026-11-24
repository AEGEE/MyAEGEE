const { startServer, stopServer } = require('../../lib/server');
const { sequelize } = require('../../lib/sequelize');
const config = require('../../config');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { RefreshToken, MailChange, PasswordReset, User } = require('../../models');

const BUSY = {
    success: false,
    message: 'Another request for the same data is being processed. Please try again in a moment.'
};

// Three routes process requests for the same token or member one by one. A request that has to
// wait for another one gives up after `lock_timeout`, instead of holding a database connection
// for as long as the other one takes. Here the test itself holds the lock.
describe('Waiting for another request', () => {
    const original = config.lock_timeout;
    let holder;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        config.lock_timeout = 200;
        holder = await sequelize.transaction();
    });

    afterEach(async () => {
        config.lock_timeout = original;
        if (!holder.finished) {
            await holder.rollback();
        }

        await generator.clearAll();
        mock.cleanAll();
    });

    // The lock the email change routes take for a member.
    const lockMailChanges = (user) => sequelize.query('SELECT pg_advisory_xact_lock(1, :id)', {
        replacements: { id: user.id },
        transaction: holder
    });

    test('waits 3 seconds by default', () => {
        expect(original).toEqual(3 * 1000);
    });

    test('POST /renew answers 503 and renews nothing while the token is locked', async () => {
        const user = await generator.createUser();
        const refreshToken = await generator.createRefreshToken(user);
        await RefreshToken.findByPk(refreshToken.id, { lock: holder.LOCK.UPDATE, transaction: holder });

        const res = await request({ path: '/renew', method: 'POST', body: { refresh_token: refreshToken.value } });

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(BUSY);

        await holder.rollback();
        expect(await RefreshToken.count()).toEqual(1);

        const again = await request({ path: '/renew', method: 'POST', body: { refresh_token: refreshToken.value } });
        expect(again.statusCode).toEqual(200);
    });

    test('PUT /members/:user_id/email answers 503 and requests nothing while the member is locked', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        await lockMailChanges(user);

        const res = await request({
            path: '/members/me/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'new@example.com' }
        });

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(BUSY);

        await holder.rollback();
        expect(await MailChange.count()).toEqual(0);
        expect(mails).toEqual([]);
    });

    test('POST /confirm-email-change answers 503 and changes nothing while the member is locked', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser({ email: 'current@example.com' });
        const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });
        await lockMailChanges(user);

        const res = await request({ path: '/confirm-email-change', method: 'POST', body: { token: mailChange.value } });

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(BUSY);

        await holder.rollback();
        expect((await User.findByPk(user.id)).email).toEqual('current@example.com');
        expect(mails).toEqual([]);

        const again = await request({ path: '/confirm-email-change', method: 'POST', body: { token: mailChange.value } });
        expect(again.statusCode).toEqual(200);
    });

    // The notice that the email changed goes out only once nothing else can make the change fail.
    test('POST /confirm-email-change sends no notice when a password reset of the member is locked', async () => {
        const mails = mock.captureMails();
        const user = await generator.createUser({ email: 'current@example.com' });
        const reset = await generator.createPasswordReset(user);
        const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });
        await PasswordReset.findByPk(reset.id, { lock: holder.LOCK.UPDATE, transaction: holder });

        const res = await request({ path: '/confirm-email-change', method: 'POST', body: { token: mailChange.value } });

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(BUSY);
        expect(mails).toEqual([]);

        await holder.rollback();
        expect((await User.findByPk(user.id)).email).toEqual('current@example.com');
        expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(1);

        const again = await request({ path: '/confirm-email-change', method: 'POST', body: { token: mailChange.value } });
        expect(again.statusCode).toEqual(200);
        expect(mails.map((mail) => mail.template)).toEqual(['mail_change_notice.html']);
    });

    test('a request that does not have to wait is not affected', async () => {
        const user = await generator.createUser();
        const otherUser = await generator.createUser();
        const token = await generator.createAccessToken(user);
        await lockMailChanges(otherUser);

        const res = await request({
            path: '/members/me/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'new@example.com' }
        });

        expect(res.statusCode).toEqual(200);
    });
});
