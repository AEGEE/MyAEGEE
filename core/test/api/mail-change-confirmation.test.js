const { startServer, stopServer } = require('../../lib/server');
const { MailChange, User } = require('../../models');
const constants = require('../../lib/constants');

const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

describe('Mail change confirm', () => {
    let mails;

    const confirm = (token) => request({
        path: '/confirm-email-change',
        method: 'POST',
        body: { token }
    });

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mails = mock.captureMails();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should return 404 if the mail change is not found', async () => {
        const res = await confirm('1');

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if no token is provided', async () => {
        const user = await generator.createUser();
        await generator.createMailChange(user);

        const res = await request({
            path: '/confirm-email-change',
            method: 'POST',
            body: {}
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.email).toEqual(user.email);
    });

    test('should fail if token is expired', async () => {
        const user = await generator.createUser();
        const mailChange = await generator.createMailChange(user, { expires_at: new Date() });

        const res = await confirm(mailChange.value);

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should work if the token is found', async () => {
        const user = await generator.createUser();
        const mailChange = await generator.createMailChange(user);

        const res = await confirm(mailChange.value);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
        expect(res.body.data).toEqual({ changed: true });

        const mailChanges = await MailChange.count({ where: { user_id: user.id } });
        expect(mailChanges).toEqual(0);

        const userFromDb = await User.scope('withPassword').findByPk(user.id);
        expect(userFromDb.email).toEqual(mailChange.new_email);
    });

    test('should work if the token is found with email with spaces/tabs', async () => {
        const user = await generator.createUser();
        const mailChange = await generator.createMailChange(user);

        const res = await confirm('\t\t\t   \t' + mailChange.value + '\t     \t');

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    describe('when only the new address has to confirm', () => {
        test('should tell the old address that the member changed it themselves', async () => {
            const user = await generator.createUser({ first_name: 'Some', last_name: 'One', email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: true });

            expect(mails.length).toEqual(1);
            expect(mails[0]).toEqual(expect.objectContaining({
                to: 'current@example.com',
                subject: constants.MAIL_SUBJECTS.MAIL_CHANGE_NOTICE,
                template: 'mail_change_notice.html',
                parameters: {
                    name: 'Some',
                    surname: 'One',
                    new_email: 'new@example.com',
                    changed_by: 'yourself'
                }
            }));
        });

        test('should tell the old address who asked for the change', async () => {
            const requester = await generator.createUser({ first_name: 'Member', last_name: 'Manager' });
            const user = await generator.createUser({ first_name: 'Some', last_name: 'One', email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com', requested_by: requester.id });

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: true });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('new@example.com');

            expect(mails.length).toEqual(1);
            expect(mails[0].to).toEqual('current@example.com');
            expect(mails[0].template).toEqual('mail_change_notice.html');
            expect(mails[0].parameters).toEqual({
                name: 'Some',
                surname: 'One',
                new_email: 'new@example.com',
                changed_by: 'Member Manager'
            });
        });

        test('should also tell the notification address if it is another one', async () => {
            const user = await generator.createUser({
                email: 'current@example.com',
                gsuite_id: 'some.one@aegee.eu',
                primary_email: 'gsuite'
            });
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: true });

            expect(mails.length).toEqual(1);
            expect(mails[0].to).toEqual(['current@example.com', 'some.one@aegee.eu']);
            expect(mails[0].template).toEqual('mail_change_notice.html');
        });

        test('should fail if another member has the new address by now', async () => {
            const user = await generator.createUser({ email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });
            await generator.createUser({ email: 'new@example.com' });

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('email');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');

            expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(1);
            expect(mails.length).toEqual(0);
        });

        test('should not change anything if the notice cannot be sent', async () => {
            mock.mockAll({ mailer: { netError: true } });

            const user = await generator.createUser({ email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');
            expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(1);
        });

        test('should fail if the login address is not the one the change was requested for anymore', async () => {
            const user = await generator.createUser({ email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com', old_email: 'earlier@example.com' });

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');
            expect(mails.length).toEqual(0);
        });

        test('should remove the other pending changes of the member', async () => {
            const user = await generator.createUser({ email: 'current@example.com' });
            const otherUser = await generator.createUser();
            const mailChange = await generator.createMailChange(user, { new_email: 'new@example.com' });
            await generator.createMailChange(user, { new_email: 'another@example.com', old_value: 'old-token' });
            await generator.createMailChange(otherUser);

            const res = await confirm(mailChange.value);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: true });

            expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(0);
            expect(await MailChange.count({ where: { user_id: otherUser.id } })).toEqual(1);
        });
    });

    test('should only let one change of a member take effect if several are confirmed at the same time', async () => {
        const user = await generator.createUser({ email: 'current@example.com' });
        await generator.createMailChange(user, { new_email: 'first@example.com', value: 'first-token' });
        await generator.createMailChange(user, { new_email: 'second@example.com', value: 'second-token' });

        const responses = await Promise.all([confirm('first-token'), confirm('second-token')]);

        expect(responses.map((res) => res.statusCode).sort()).toEqual([200, 404]);

        const changed = responses.find((res) => res.statusCode === 200);
        expect(changed.body.data).toEqual({ changed: true });

        const userFromDb = await User.findByPk(user.id);
        expect(['first@example.com', 'second@example.com']).toContain(userFromDb.email);
        expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(0);

        expect(mails.length).toEqual(1);
        expect(mails[0].parameters.new_email).toEqual(userFromDb.email);
    });

    test('should return 404 if the token is not a string', async () => {
        const user = await generator.createUser();
        await generator.createMailChange(user, { old_value: 'old-token' });

        for (const token of [{ value: 'token' }, ['token'], 42, true]) {
            const res = await request({
                path: '/confirm-email-change',
                method: 'POST',
                body: { token }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.message).toEqual('Token is invalid.');
        }

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.email).toEqual(user.email);
    });

    describe('when the current address has to confirm as well', () => {
        const createPendingChange = async (options = {}) => {
            const requester = await generator.createUser({ first_name: 'Board', last_name: 'Member' });
            const user = await generator.createUser({ first_name: 'Some', last_name: 'One', email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, {
                new_email: 'new@example.com',
                value: 'new-token',
                old_value: 'old-token',
                requested_by: requester.id,
                ...options
            });

            return { requester, user, mailChange };
        };

        test('should wait for the current address after the new one confirmed', async () => {
            const { user } = await createPendingChange();

            const res = await confirm('new-token');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');
            expect(res.body.data).toEqual({ changed: false, waiting_for: 'old_email' });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');

            const changeFromDb = await MailChange.findOne({ where: { user_id: user.id } });
            expect(changeFromDb.new_confirmed_at).not.toBeNull();
            expect(changeFromDb.old_confirmed_at).toBeNull();

            expect(mails.length).toEqual(0);
        });

        test('should change the email after the current address confirmed too', async () => {
            const { user } = await createPendingChange();

            await confirm('new-token');
            const res = await confirm('old-token');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');
            expect(res.body.data).toEqual({ changed: true });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('new@example.com');
            expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(0);

            expect(mails.length).toEqual(1);
            expect(mails[0]).toEqual(expect.objectContaining({
                to: 'current@example.com',
                subject: constants.MAIL_SUBJECTS.MAIL_CHANGE_NOTICE,
                template: 'mail_change_notice.html',
                parameters: {
                    name: 'Some',
                    surname: 'One',
                    new_email: 'new@example.com',
                    changed_by: 'Board Member'
                }
            }));
        });

        test('should wait for the new address after the current one confirmed', async () => {
            const { user } = await createPendingChange();

            const res = await confirm('old-token');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data).toEqual({ changed: false, waiting_for: 'new_email' });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');

            const changeFromDb = await MailChange.findOne({ where: { user_id: user.id } });
            expect(changeFromDb.new_confirmed_at).toBeNull();
            expect(changeFromDb.old_confirmed_at).not.toBeNull();

            expect(mails.length).toEqual(0);
        });

        test('should change the email after the new address confirmed too', async () => {
            const { user } = await createPendingChange();

            await confirm('old-token');
            const res = await confirm('new-token');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: true });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('new@example.com');
            expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(0);

            expect(mails.length).toEqual(1);
            expect(mails[0].template).toEqual('mail_change_notice.html');
        });

        test('should keep waiting if the same address confirms twice', async () => {
            const { user } = await createPendingChange();

            await confirm('new-token');
            const res = await confirm('new-token');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: false, waiting_for: 'old_email' });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');
            expect(mails.length).toEqual(0);
        });

        test('should change the email only once if both addresses confirm at the same time', async () => {
            const { user } = await createPendingChange();

            const responses = await Promise.all([confirm('new-token'), confirm('old-token')]);

            expect(responses.map((res) => res.statusCode)).toEqual([200, 200]);
            expect(responses.map((res) => res.body.data.changed).sort()).toEqual([false, true]);

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('new@example.com');
            expect(mails.length).toEqual(1);
        });

        test('should fail if the token for the current address is expired', async () => {
            const { user } = await createPendingChange({ expires_at: new Date(), new_confirmed_at: new Date() });

            const res = await confirm('old-token');

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');
            expect(mails.length).toEqual(0);
        });

        test('should not count a confirmation for the change of another member', async () => {
            const { user } = await createPendingChange({ new_confirmed_at: new Date() });

            const otherUser = await generator.createUser({ email: 'other@example.com' });
            await generator.createMailChange(otherUser, {
                new_email: 'other-new@example.com',
                value: 'other-new-token',
                old_value: 'other-old-token'
            });

            const res = await confirm('other-old-token');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ changed: false, waiting_for: 'new_email' });

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');

            const otherUserFromDb = await User.findByPk(otherUser.id);
            expect(otherUserFromDb.email).toEqual('other@example.com');

            const changeFromDb = await MailChange.findOne({ where: { user_id: user.id } });
            expect(changeFromDb.old_confirmed_at).toBeNull();
            expect(mails.length).toEqual(0);
        });

        test('should fail if another member has the new address by now', async () => {
            const { user } = await createPendingChange({ new_confirmed_at: new Date() });
            await generator.createUser({ email: 'new@example.com' });

            const res = await confirm('old-token');

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('email');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');

            expect(await MailChange.count({ where: { user_id: user.id } })).toEqual(1);
            expect(mails.length).toEqual(0);
        });

        test('should remove the request if the account of the requester is deleted', async () => {
            const { requester, user } = await createPendingChange({ new_confirmed_at: new Date() });
            await requester.destroy();

            const res = await confirm('old-token');

            expect(res.statusCode).toEqual(404);

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.email).toEqual('current@example.com');
        });
    });
});
