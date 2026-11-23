const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Users list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_unconfirmed', object: 'member' });

        const otherUser = await generator.createUser({ mail_confirmed_at: null });

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(otherUser.id);
    });

    test('should name the permission that is needed', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        // The permission to see all members is not the one for this list.
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({
            success: false,
            message: 'Permission global:view_unconfirmed:member is required, but not present.'
        });
    });

    test('should list the members who are not confirmed, and nobody else', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view_unconfirmed', object: 'member' });

        await generator.createUser();
        const first = await generator.createUser({ mail_confirmed_at: null });
        const second = await generator.createUser({ mail_confirmed_at: null, active: false });

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(Object.keys(res.body).sort()).toEqual(['data', 'meta', 'success']);
        expect(res.body.meta).toEqual({ count: 2 });
        expect(res.body.data.map((item) => item.id)).toEqual([first.id, second.id]);
        for (const member of res.body.data) {
            expect(member.mail_confirmed_at).toBeNull();
            expect(member).not.toHaveProperty('password');
        }
    });

    test('should respect the query, the limit and the offset, and count all that match', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view_unconfirmed', object: 'member' });

        await generator.createUser({ first_name: 'Zzzmatch' });
        await generator.createUser({ first_name: 'Other', mail_confirmed_at: null });
        await generator.createUser({ first_name: 'Zzzmatch', mail_confirmed_at: null });
        const second = await generator.createUser({ last_name: 'Zzzmatch', mail_confirmed_at: null });
        await generator.createUser({ email: 'zzzmatch@example.com', mail_confirmed_at: null });

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            query: { query: 'zzzmatch', limit: 1, offset: 1 },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((item) => item.id)).toEqual([second.id]);
        expect(res.body.meta).toEqual({ count: 3 });
    });

    test('should respect the sorting', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view_unconfirmed', object: 'member' });

        const first = await generator.createUser({ first_name: 'Aaa', mail_confirmed_at: null });
        const second = await generator.createUser({ first_name: 'Bbb', mail_confirmed_at: null });

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            query: { sort: 'first_name', direction: 'desc' },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((item) => item.id)).toEqual([second.id, first.id]);
    });

    test('should not take "unconfirmed" for the username of a member', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view_unconfirmed', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        await generator.createUser({ username: 'unconfirmed' });

        const res = await request({
            path: '/members/unconfirmed',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [], meta: { count: 0 } });
    });
});
