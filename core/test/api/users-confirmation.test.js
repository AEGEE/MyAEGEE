const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { MailConfirmation, User } = require('../../models');

describe('User confirmation', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the user is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });

        const res = await request({
            path: '/members/2147483647/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });
        await generator.createMailConfirmation(null, { user_id: user.id });

        const res = await request({
            path: '/members/' + user.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.mail_confirmed_at).not.toEqual(null);
    });

    test('should fail without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work for a member without a pending confirmation', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });

        // Like a member that a board created, or one whose confirmation was removed.
        const member = await generator.createUser({ mail_confirmed_at: null });

        const res = await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.mail_confirmed_at).not.toEqual(null);
    });

    test('should keep the date of a member who is confirmed already', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });

        const confirmedAt = new Date('2020-01-01T00:00:00.000Z');
        const member = await generator.createUser({ mail_confirmed_at: confirmedAt });

        const res = await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.mail_confirmed_at).toEqual(confirmedAt.toISOString());
    });

    test('should remove the pending confirmation', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });

        const member = await generator.createUser({ mail_confirmed_at: null });
        await generator.createMailConfirmation(member);

        const res = await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(await MailConfirmation.count({ where: { user_id: member.id } })).toEqual(0);
    });

    test('should name the permission and keep the member unconfirmed without it', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const member = await generator.createUser({ mail_confirmed_at: null });
        await generator.createMailConfirmation(member);

        const res = await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Permission global:confirm:member is required, but not present.' });

        expect((await User.findByPk(member.id)).mail_confirmed_at).toBeNull();
        expect(await MailConfirmation.count({ where: { user_id: member.id } })).toEqual(1);
    });

    test('should not be enough to hold the local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'confirm', object: 'member' });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const member = await generator.createUser({ mail_confirmed_at: null });
        await generator.createBodyMembership(body, member);

        const res = await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect((await User.findByPk(member.id)).mail_confirmed_at).toBeNull();
    });

    test('should store the date, and confirm nobody else', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });

        const member = await generator.createUser({ mail_confirmed_at: null });
        const otherMember = await generator.createUser({ mail_confirmed_at: null });
        const otherConfirmation = await generator.createMailConfirmation(otherMember);

        const before = Date.now();
        const res = await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(member.id);

        const fromDb = await User.findByPk(member.id);
        expect(fromDb.mail_confirmed_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
        expect(res.body.data.mail_confirmed_at).toEqual(fromDb.mail_confirmed_at.toISOString());

        expect((await User.findByPk(otherMember.id)).mail_confirmed_at).toBeNull();
        expect((await MailConfirmation.findAll()).map((item) => item.id)).toEqual([otherConfirmation.id]);
    });

    test('should let the member log in after that', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'confirm', object: 'member' });

        const member = await generator.createUser({ mail_confirmed_at: null, password: 'testtest' });
        const login = () => request({
            path: '/login',
            method: 'POST',
            body: { username: member.email, password: 'testtest' }
        });

        expect((await login()).statusCode).toEqual(403);

        await request({
            path: '/members/' + member.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect((await login()).statusCode).toEqual(200);
    });
});
