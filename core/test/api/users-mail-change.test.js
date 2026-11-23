const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { MailChange, User } = require('../../models');
const constants = require('../../lib/constants');

describe('User mail change', () => {
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

    test('should return 404 if the user is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/1337/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new_email is not provided', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'not-valid' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('new_email');
    });

    test('should fail if the email is not unique', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createUser({ email: 'test@example.com' });

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@example.com' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new mail in in @aegee.eu', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@aegee.eu' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new mail in in @aegee.org', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@aegee.org' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if new mail is in a subdomain of a restricted domain', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@sub.aegee.org' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if new mail only looks like a restricted domain', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@notaegee.org' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const changeFromDb = await MailChange.findOne({ where: { user_id: user.id } });
        expect(changeFromDb.new_email).toEqual('test@notaegee.org');
    });

    test('should fail if mailer fails', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const changeFromDb = await MailChange.findOne({ where: { user_id: user.id } });
        expect(changeFromDb).not.toEqual(null);
    });

    test('should work for current user for /me without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should work for current user for /:user_id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    describe('who has to confirm', () => {
        // A member of a circle of the body which has local:update:member, like a board member.
        const createLocalManager = async (body, options = {}) => {
            const manager = await generator.createUser(options);
            const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
            const circle = await generator.createCircle({ body_id: body.id });
            await generator.createCircleMembership(circle, manager);
            await generator.createCirclePermission(circle, permission);

            return manager;
        };

        const createGlobalManager = async (options = {}) => {
            const manager = await generator.createUser(options);
            const permission = await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });
            const circle = await generator.createCircle();
            await generator.createCircleMembership(circle, manager);
            await generator.createCirclePermission(circle, permission);

            return manager;
        };

        test('should need the current and the new address for a holder of the local permission', async () => {
            const mails = mock.captureMails();

            const body = await generator.createBody();
            const manager = await createLocalManager(body, { first_name: 'Board', last_name: 'Member' });
            const token = await generator.createAccessToken(manager);

            const member = await generator.createUser({ first_name: 'Some', last_name: 'One', email: 'current@example.com' });
            await generator.createBodyMembership(body, member);

            const res = await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('message');
            expect(res.body.data).toEqual({ needs_old_address_confirmation: true });

            const memberFromDb = await User.findByPk(member.id);
            expect(memberFromDb.email).toEqual('current@example.com');

            const changes = await MailChange.findAll({ where: { user_id: member.id } });
            expect(changes.length).toEqual(1);
            expect(changes[0].new_email).toEqual('new@example.com');
            expect(changes[0].old_email).toEqual('current@example.com');
            expect(changes[0].requested_by).toEqual(manager.id);
            expect(changes[0].old_value).not.toBeNull();
            expect(changes[0].old_value).not.toEqual(changes[0].value);
            expect(changes[0].new_confirmed_at).toBeNull();
            expect(changes[0].old_confirmed_at).toBeNull();

            expect(mails.length).toEqual(2);
            expect(mails).toContainEqual(expect.objectContaining({
                to: 'new@example.com',
                subject: constants.MAIL_SUBJECTS.MAIL_CHANGE,
                template: 'mail_change.html',
                parameters: { name: 'Some', surname: 'One', token: changes[0].value }
            }));
            expect(mails).toContainEqual(expect.objectContaining({
                to: 'current@example.com',
                subject: constants.MAIL_SUBJECTS.MAIL_CHANGE_OLD_CONFIRM,
                template: 'mail_change_old_confirm.html',
                parameters: {
                    name: 'Some',
                    surname: 'One',
                    new_email: 'new@example.com',
                    requester_name: 'Board Member',
                    token: changes[0].old_value
                }
            }));
        });

        test('should only need the new address for a holder of the global permission', async () => {
            const mails = mock.captureMails();

            const manager = await createGlobalManager();
            const token = await generator.createAccessToken(manager);
            const member = await generator.createUser({ first_name: 'Some', last_name: 'One', email: 'current@example.com' });

            const res = await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');
            expect(res.body.data).toEqual({ needs_old_address_confirmation: false });

            const changes = await MailChange.findAll({ where: { user_id: member.id } });
            expect(changes.length).toEqual(1);
            expect(changes[0].old_value).toBeNull();
            expect(changes[0].old_email).toEqual('current@example.com');
            expect(changes[0].requested_by).toEqual(manager.id);

            expect(mails.length).toEqual(1);
            expect(mails[0]).toEqual(expect.objectContaining({
                to: 'new@example.com',
                subject: constants.MAIL_SUBJECTS.MAIL_CHANGE,
                template: 'mail_change.html',
                parameters: { name: 'Some', surname: 'One', token: changes[0].value }
            }));
        });

        test('should only need the new address for a holder of both the local and the global permission', async () => {
            const mails = mock.captureMails();

            const body = await generator.createBody();
            const manager = await createLocalManager(body);
            const globalPermission = await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });
            const globalCircle = await generator.createCircle();
            await generator.createCircleMembership(globalCircle, manager);
            await generator.createCirclePermission(globalCircle, globalPermission);
            const token = await generator.createAccessToken(manager);

            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const res = await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ needs_old_address_confirmation: false });

            const change = await MailChange.findOne({ where: { user_id: member.id } });
            expect(change.old_value).toBeNull();
            expect(mails.length).toEqual(1);
        });

        test('should only need the new address for the member themselves', async () => {
            const mails = mock.captureMails();

            const user = await generator.createUser({ first_name: 'Some', last_name: 'One', email: 'current@example.com' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('message');
            expect(res.body.data).toEqual({ needs_old_address_confirmation: false });

            const changes = await MailChange.findAll({ where: { user_id: user.id } });
            expect(changes.length).toEqual(1);
            expect(changes[0].old_value).toBeNull();
            expect(changes[0].old_email).toEqual('current@example.com');
            expect(changes[0].requested_by).toBeNull();

            expect(mails.length).toEqual(1);
            expect(mails[0]).toEqual(expect.objectContaining({
                to: 'new@example.com',
                template: 'mail_change.html',
                parameters: { name: 'Some', surname: 'One', token: changes[0].value }
            }));
        });

        test('should only need the new address for a holder of the local permission changing their own email', async () => {
            const body = await generator.createBody();
            const manager = await createLocalManager(body);
            await generator.createBodyMembership(body, manager);
            const token = await generator.createAccessToken(manager);

            const res = await request({
                path: '/members/' + manager.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ needs_old_address_confirmation: false });

            const change = await MailChange.findOne({ where: { user_id: manager.id } });
            expect(change.old_value).toBeNull();
            expect(change.requested_by).toBeNull();
        });

        test('should fail for a holder of the local permission and a member of another body', async () => {
            const mails = mock.captureMails();

            const body = await generator.createBody();
            const otherBody = await generator.createBody();
            const manager = await createLocalManager(body);
            const token = await generator.createAccessToken(manager);

            const member = await generator.createUser();
            await generator.createBodyMembership(otherBody, member);

            const res = await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');

            expect(await MailChange.count()).toEqual(0);
            expect(mails.length).toEqual(0);
        });

        test('should use long tokens for both addresses', async () => {
            const body = await generator.createBody();
            const manager = await createLocalManager(body);
            const token = await generator.createAccessToken(manager);

            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            const change = await MailChange.findOne({ where: { user_id: member.id } });
            expect(change.value.length).toEqual(constants.TOKEN_LENGTH.MAIL_CHANGE);
            expect(change.old_value.length).toEqual(constants.TOKEN_LENGTH.MAIL_CHANGE);
        });

        test('should not save the request if a mail cannot be sent', async () => {
            mock.mockAll({ mailer: { netError: true } });

            const body = await generator.createBody();
            const manager = await createLocalManager(body);
            const token = await generator.createAccessToken(manager);

            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const res = await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(await MailChange.count()).toEqual(0);
        });

        test('should need the current address too regardless of when the member joined the body', async () => {
            const body = await generator.createBody();
            const manager = await createLocalManager(body);
            const addPermission = await generator.createPermission({ scope: 'local', action: 'add_member', object: 'body' });
            const addCircle = await generator.createCircle({ body_id: body.id });
            await generator.createCircleMembership(addCircle, manager);
            await generator.createCirclePermission(addCircle, addPermission);
            const token = await generator.createAccessToken(manager);

            // Not a member of any body yet.
            const member = await generator.createUser({ email: 'current@example.com' });

            const addResponse = await request({
                path: '/bodies/' + body.id + '/members',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { user_id: member.id }
            });
            expect(addResponse.statusCode).toEqual(200);

            const changeResponse = await request({
                path: '/members/' + member.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });
            expect(changeResponse.statusCode).toEqual(200);
            expect(changeResponse.body.data).toEqual({ needs_old_address_confirmation: true });

            const change = await MailChange.findOne({ where: { user_id: member.id } });
            const mails = mock.captureMails();

            const confirmResponse = await request({
                path: '/confirm-email-change',
                method: 'POST',
                body: { token: change.value }
            });
            expect(confirmResponse.statusCode).toEqual(200);
            expect(confirmResponse.body.data).toEqual({ changed: false, waiting_for: 'old_email' });

            const memberFromDb = await User.findByPk(member.id);
            expect(memberFromDb.email).toEqual('current@example.com');
            expect(mails.length).toEqual(0);
        });

        test('should need the current and the new address for a holder of the join request permission', async () => {
            const body = await generator.createBody();
            const manager = await generator.createUser();
            const permission = await generator.createPermission({ scope: 'join_request', action: 'update', object: 'member' });
            const circle = await generator.createCircle({ body_id: body.id });
            await generator.createCircleMembership(circle, manager);
            await generator.createCirclePermission(circle, permission);
            const token = await generator.createAccessToken(manager);

            const applicant = await generator.createUser();
            await generator.createJoinRequest(body, applicant);

            const res = await request({
                path: '/members/' + applicant.id + '/email',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { new_email: 'new@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({ needs_old_address_confirmation: true });

            const change = await MailChange.findOne({ where: { user_id: applicant.id } });
            expect(change.old_value).not.toBeNull();
        });
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/email',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { new_email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
