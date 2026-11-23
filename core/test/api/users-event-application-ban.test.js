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

    test('should store who set the ban and until when', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const banUntil = moment().add(1, 'month').milliseconds(0);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: banUntil.toISOString() }
        });

        expect(res.statusCode).toEqual(200);
        expect(Object.keys(res.body).sort()).toEqual(['data', 'success']);
        expect(Object.keys(res.body.data).sort()).toEqual([
            'ban_until',
            'banned_by_user_id',
            'created_at',
            'id',
            'lifted_at',
            'lifted_by_user_id',
            'updated_at',
            'user_id'
        ]);

        const bans = await EventApplicationBan.findAll();
        expect(bans).toHaveLength(1);
        expect(bans[0].id).toEqual(res.body.data.id);
        expect(bans[0].user_id).toEqual(target.id);
        expect(bans[0].banned_by_user_id).toEqual(user.id);
        expect(bans[0].ban_until.toISOString()).toEqual(banUntil.toISOString());
        expect(bans[0].lifted_at).toBeNull();
        expect(bans[0].lifted_by_user_id).toBeNull();
    });

    test('should not store a ban without the permission', async () => {
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
        expect(res.body).toEqual({
            success: false,
            message: 'Permission global:update_application_ban:member is required, but not present.'
        });

        expect(await EventApplicationBan.count()).toEqual(0);
    });

    test.each([
        ['is not a date', 'not a date'],
        ['is a date that does not exist', '2026-02-30T12:00:00.000Z'],
        ['is null', null],
        ['is missing', undefined]
    ])('should reject a ban if the end date %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({
            success: false,
            errors: { ban_until: ['Ban end date should be valid.'] }
        });

        expect(await EventApplicationBan.count()).toEqual(0);
    });

    test.each([
        ['is in the past', () => moment().subtract(1, 'day').toISOString()],
        ['is now', () => moment().toISOString()]
    ])('should reject a ban if the end date %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: value() }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({
            success: false,
            errors: { ban_until: ['Ban end date should be in the future.'] }
        });

        expect(await EventApplicationBan.count()).toEqual(0);
    });

    test('should name the limit when rejecting a ban that is too long', async () => {
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
        expect(res.body).toEqual({
            success: false,
            errors: { ban_until: ['Ban end date cannot be more than 3 months in the future.'] }
        });

        expect(await EventApplicationBan.count()).toEqual(0);
    });

    test('should keep the active ban when a new one is rejected', async () => {
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const ban = await generator.createEventApplicationBan(target, user, { ban_until: moment().add(1, 'month').toDate() });

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { ban_until: moment().subtract(1, 'day').toISOString() }
        });

        expect(res.statusCode).toEqual(422);

        const bans = await EventApplicationBan.findAll();
        expect(bans).toHaveLength(1);
        expect(bans[0].id).toEqual(ban.id);
        expect(bans[0].lifted_at).toBeNull();
    });

    test('should store who lifted the ban and when', async () => {
        const banner = await generator.createUser();
        const user = await generator.createUser({ superadmin: true });
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const ban = await generator.createEventApplicationBan(target, banner, { ban_until: moment().add(1, 'month').toDate() });

        await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

        const before = new Date();
        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'Event application ban was lifted.' });

        // The ban is kept as a record of what happened.
        const bans = await EventApplicationBan.findAll();
        expect(bans).toHaveLength(1);
        expect(bans[0].id).toEqual(ban.id);
        expect(bans[0].banned_by_user_id).toEqual(banner.id);
        expect(bans[0].lifted_by_user_id).toEqual(user.id);
        expect(bans[0].lifted_at.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
        expect(bans[0].lifted_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        expect(bans[0].ban_until.getTime()).toEqual(ban.ban_until.getTime());
    });

    test('should require permission to lift a ban, and keep the ban', async () => {
        const banner = await generator.createUser();
        const user = await generator.createUser();
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const ban = await generator.createEventApplicationBan(target, banner, { ban_until: moment().add(1, 'month').toDate() });

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({
            success: false,
            message: 'Permission global:update_application_ban:member is required, but not present.'
        });

        await ban.reload();
        expect(ban.lifted_at).toBeNull();
        expect(ban.lifted_by_user_id).toBeNull();
    });

    test('should not let a member lift their own ban', async () => {
        const banner = await generator.createUser();
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const ban = await generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() });

        const res = await request({
            path: '/members/me/event-application-ban',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);

        await ban.reload();
        expect(ban.lifted_at).toBeNull();
    });

    test('should not let a holder of the local permission lift a ban', async () => {
        const banner = await generator.createUser();
        const user = await generator.createUser();
        const target = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const ban = await generator.createEventApplicationBan(target, banner, { ban_until: moment().add(1, 'month').toDate() });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'update_application_ban', object: 'member' });
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);
        await generator.createBodyMembership(body, user);
        await generator.createBodyMembership(body, target);

        const res = await request({
            path: '/members/' + target.id + '/event-application-ban',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);

        await ban.reload();
        expect(ban.lifted_at).toBeNull();
    });

    describe('lifting without an active ban', () => {
        const NO_ACTIVE_BAN = { success: false, message: 'This user does not have an active event application ban.' };

        const lift = async (target) => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

            return request({
                path: '/members/' + target.id + '/event-application-ban',
                method: 'DELETE',
                headers: { 'X-Auth-Token': token.value }
            });
        };

        test('should return 404 if the member was never banned', async () => {
            const target = await generator.createUser();

            const res = await lift(target);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual(NO_ACTIVE_BAN);
            expect(await EventApplicationBan.count()).toEqual(0);
        });

        test('should return 404 if the ban was lifted already, and keep who lifted it', async () => {
            const banner = await generator.createUser();
            const target = await generator.createUser();
            const liftedAt = moment().subtract(1, 'hour').milliseconds(0).toDate();
            const ban = await generator.createEventApplicationBan(target, banner, {
                ban_until: moment().add(1, 'month').toDate(),
                lifted_at: liftedAt,
                lifted_by_user_id: banner.id
            });

            const res = await lift(target);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual(NO_ACTIVE_BAN);

            await ban.reload();
            expect(ban.lifted_at.getTime()).toEqual(liftedAt.getTime());
            expect(ban.lifted_by_user_id).toEqual(banner.id);
        });

        test('should return 404 if the ban has ended by itself, and not mark it as lifted', async () => {
            const banner = await generator.createUser();
            const target = await generator.createUser();
            // A ban can't be created with an end date in the past, so the validation is skipped.
            const ban = await EventApplicationBan.create({
                user_id: target.id,
                banned_by_user_id: banner.id,
                ban_until: moment().subtract(1, 'day').toDate()
            }, { validate: false });

            const res = await lift(target);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual(NO_ACTIVE_BAN);

            await ban.reload();
            expect(ban.lifted_at).toBeNull();
            expect(ban.lifted_by_user_id).toBeNull();
        });

        test('should return 404 if only another member is banned, and keep that ban', async () => {
            const banner = await generator.createUser();
            const target = await generator.createUser();
            const otherMember = await generator.createUser();
            const ban = await generator.createEventApplicationBan(otherMember, banner, { ban_until: moment().add(1, 'month').toDate() });

            const res = await lift(target);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual(NO_ACTIVE_BAN);

            await ban.reload();
            expect(ban.lifted_at).toBeNull();
        });
    });
});
