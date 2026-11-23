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
            path: '/members',
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

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const member = await generator.createUser();
        await generator.createUser();

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(member.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const firstUser = await generator.createUser({
            first_name: 'aaa',
            mail_confirmed_at: new Date(),
            superadmin: true
        });
        const token = await generator.createAccessToken(firstUser);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const secondUser = await generator.createUser({ first_name: 'bbb' });

        const res = await request({
            path: '/members?sort=first_name&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondUser.id);
        expect(res.body.data[1].id).toEqual(firstUser.id);
    });

    test('should find by first_name', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'aaa', last_name: 'bbb', email: 'ccc@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find by last_name', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'aaa', email: 'ccc@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find by email', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'aaa@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should name the permission that is needed', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Permission global:view:member is required, but not present.' });
    });

    test('should not be enough to hold the local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'view', object: 'member' });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should list every member once, by id, with the total', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const confirmed = await generator.createUser();
        const unconfirmed = await generator.createUser({ mail_confirmed_at: null });
        const suspended = await generator.createUser({ active: false });

        const res = await request({
            path: '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(Object.keys(res.body).sort()).toEqual(['data', 'meta', 'success']);
        expect(res.body.meta).toEqual({ count: 4 });
        expect(res.body.data.map((item) => item.id)).toEqual([user.id, confirmed.id, unconfirmed.id, suspended.id]);
    });

    test('should have the stored fields of each member and the notification email, without the password', async () => {
        const user = await generator.createUser({
            superadmin: true,
            email: 'some.one@example.com',
            gsuite_id: 'some.one@aegee.eu',
            primary_email: 'gsuite',
            password: 'a-secret-password'
        });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expect.objectContaining({
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            email: 'some.one@example.com',
            gsuite_id: 'some.one@aegee.eu',
            primary_email: 'gsuite',
            notification_email: 'some.one@aegee.eu',
            superadmin: true,
            active: true
        }));
        expect(res.body.data[0]).not.toHaveProperty('password');
        // The list has the members only, not what they belong to.
        expect(res.body.data[0]).not.toHaveProperty('bodies');
        expect(res.body.data[0]).not.toHaveProperty('circles');
    });

    test('should find by the Google Workspace account, and by a first and last name together', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'Aaa', last_name: 'Bbb' });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const withAccount = await generator.createUser({ first_name: 'Ccc', last_name: 'Ddd', gsuite_id: 'zzz.account@aegee.eu' });
        const named = await generator.createUser({ first_name: 'Some', last_name: 'One' });

        const byAccount = await request({
            path: '/members',
            method: 'GET',
            query: { query: 'ZZZ.account' },
            headers: { 'X-Auth-Token': token.value }
        });
        expect(byAccount.statusCode).toEqual(200);
        expect(byAccount.body.data.map((item) => item.id)).toEqual([withAccount.id]);
        expect(byAccount.body.meta).toEqual({ count: 1 });

        const byName = await request({
            path: '/members',
            method: 'GET',
            query: { query: 'some one' },
            headers: { 'X-Auth-Token': token.value }
        });
        expect(byName.statusCode).toEqual(200);
        expect(byName.body.data.map((item) => item.id)).toEqual([named.id]);
    });

    test('should answer with an empty list and a count of 0 if nobody matches', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members',
            method: 'GET',
            query: { query: 'there-is-no-such-member' },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [], meta: { count: 0 } });
    });
});
