const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

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
            uri: '/members/1337/confirm',
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
            uri: '/members/' + user.id + '/confirm',
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
            uri: '/members/' + user.id + '/confirm',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
