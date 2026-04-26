const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('User event application ban', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should require permission to set a ban', async () => {
        const user = await generator.createUser();
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().add(1, 'month').toISOString() }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should set and return active ban', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            uri: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().add(1, 'month').toISOString() }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.user_id).toEqual(target.id);

        const userRes = await request({
            uri: '/members/' + target.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(userRes.statusCode).toEqual(200);
        expect(userRes.body.data.event_application_ban.user_id).toEqual(target.id);
    });

    test('should show active ban to the banned user', async () => {
        const user = await generator.createUser();
        const banner = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() });

        const res = await request({
            uri: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.event_application_ban.user_id).toEqual(user.id);
    });

    test('should hide active ban from users without ban management permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createEventApplicationBan(target, user, { ban_until: moment().add(1, 'month').toDate() });

        const res = await request({
            uri: '/members/' + target.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).not.toHaveProperty('event_application_ban');
    });

    test('should reject bans longer than 3 months', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const res = await request({
            uri: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().add(3, 'months').add(1, 'day').toISOString() }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('ban_until');
    });

    test('should lift active ban', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createEventApplicationBan(target, user, { ban_until: moment().add(1, 'month').toDate() });

        const res = await request({
            uri: '/members/' + target.id + '/event-application-ban',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const userRes = await request({
            uri: '/members/' + target.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(userRes.statusCode).toEqual(200);
        expect(userRes.body.data.event_application_ban).toBeNull();
    });
});
