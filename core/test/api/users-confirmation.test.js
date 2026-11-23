const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { MailConfirmation } = require('../../models');

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
            path: '/members/1337/confirm',
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
});
