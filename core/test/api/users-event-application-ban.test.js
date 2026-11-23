const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { EventApplicationBan } = require('../../models');

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
            path: '/members/' + target.id + '/event-application-ban',
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
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().add(1, 'month').toISOString() }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.user_id).toEqual(target.id);

        const userRes = await request({
            path: '/members/' + target.id,
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
            path: '/members/me',
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
            path: '/members/' + target.id,
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
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().add(3, 'months').add(1, 'day').toISOString() }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('ban_until');
    });

    test('should replace an existing active ban when setting a new ban', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const firstBan = await generator.createEventApplicationBan(target, user, {
            ban_until: moment().add(1, 'month').toDate()
        });

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().add(2, 'months').toISOString() }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).not.toEqual(firstBan.id);

        await firstBan.reload();
        expect(firstBan.lifted_at).not.toBeNull();
        expect(firstBan.lifted_by_user_id).toEqual(user.id);

        const activeBans = await EventApplicationBan.findAll({
            where: {
                user_id: target.id,
                lifted_at: null
            }
        });
        expect(activeBans).toHaveLength(1);
        expect(activeBans[0].id).toEqual(res.body.data.id);
    });

    test('should lift active ban', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createEventApplicationBan(target, user, { ban_until: moment().add(1, 'month').toDate() });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const userRes = await request({
            path: '/members/' + target.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(userRes.statusCode).toEqual(200);
        expect(userRes.body.data.event_application_ban).toBeNull();
    });

    describe('the end date of a ban', () => {
        const setBan = async (body) => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            const member = await generator.createUser();
            await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

            return request({
                path: '/members/' + member.id + '/event-application-ban',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body
            });
        };

        const inDays = (days) => new Date(Date.now() + (days * 24 * 60 * 60 * 1000));

        test.each([
            ['is missing', {}],
            ['is null', { ban_until: null }],
            ['is a number', { ban_until: inDays(10).getTime() }],
            ['is a list', { ban_until: [inDays(10).toISOString()] }],
            ['is a text that is not a date', { ban_until: 'next month' }],
            ['is a date in another notation', { ban_until: '12/31/2099' }]
        ])('should be refused as not valid if it %s', async (name, body) => {
            const res = await setBan(body);

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { ban_until: ['Ban end date should be valid.'] } });
        });

        test.each([
            ['a date', () => inDays(10).toISOString().slice(0, 10)],
            ['a date with a time', () => inDays(10).toISOString()]
        ])('should be accepted as %s in ISO notation', async (name, value) => {
            const res = await setBan({ ban_until: value() });

            expect(res.statusCode).toEqual(200);
            expect(new Date(res.body.data.ban_until).getTime()).toBeGreaterThan(Date.now());
        });
    });
});
