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

    test('should fail without query', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find own by id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + user.id,
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

    test('should refuse ids other than the own one without permission', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + user.id + ',' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should refuse ids other than the own one without permission, whatever the order', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + secondUser.id + ',' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find own by id without permission if the id is repeated', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + user.id + ',' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find own and other ids with the permission', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const thirdUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members_email?query=' + [secondUser.id, user.id, thirdUser.id].join(','),
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.map((row) => row.id).sort()).toEqual([user.id, secondUser.id, thirdUser.id].sort());
    });

    test('should find one by id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(secondUser.id);
    });

    test('should find multiple by id array', async () => {
        const user = await generator.createUser({ superadmin: true });
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=' + user.id + ',' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect([user.id, secondUser.id]).toContainEqual(res.body.data[0].id);
        expect([user.id, secondUser.id]).toContainEqual(res.body.data[1].id);
    });

    test('should fail when query is not a string of ids seperated by commas', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=a,b',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should refuse ids that no member can have', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        for (const query of ['2147483648', '99999999999999999999', `${user.id},2147483648`, '0', `${user.id},0`]) {
            const res = await request({
                path: '/members_email',
                query: { query },
                headers: { 'X-Auth-Token': token.value }
            });

            expect({ query, status: res.statusCode, message: res.body.message }).toEqual({
                query,
                status: 400,
                message: 'Query should be a string of 1 id or multiple ids seperated by commas.'
            });
        }
    });

    test('should only return id and notification email', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const expectedOutput = {
            id: user.id,
            notification_email: user.notification_email
        };

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expectedOutput);
    });

    describe('answers', () => {
        test('should say how the ids have to be given', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            for (const query of [undefined, { query: '' }, { query: 'abc' }, { query: '1,' }, { query: '1;2' }, { query: '-1' }]) {
                const res = await request({
                    path: '/members_email',
                    method: 'GET',
                    query,
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(400);
                expect(res.body).toEqual({
                    success: false,
                    message: 'Query should be a string of 1 id or multiple ids seperated by commas.'
                });
            }
        });

        test('should name the permission that is needed for other ids', async () => {
            const user = await generator.createUser();
            const otherUser = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members_email',
                method: 'GET',
                query: { query: String(otherUser.id) },
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'Permission global:mail:member is required, but not present.' });
        });

        test('should not be enough to hold the local permission', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });
            const permission = await generator.createPermission({ scope: 'local', action: 'mail', object: 'member' });
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);
            await generator.createBodyMembership(body, user);

            const otherUser = await generator.createUser();
            await generator.createBodyMembership(body, otherUser);

            const res = await request({
                path: '/members_email',
                method: 'GET',
                query: { query: String(otherUser.id) },
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).not.toHaveProperty('data');
        });

        test('should give the address that notifications go to', async () => {
            const user = await generator.createUser({ superadmin: true, email: 'admin@example.com' });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

            const withAccount = await generator.createUser({
                email: 'some.one@example.com',
                gsuite_id: 'some.one@aegee.eu',
                primary_email: 'gsuite'
            });
            const withUnusedAccount = await generator.createUser({
                email: 'other.one@example.com',
                gsuite_id: 'other.one@aegee.eu',
                primary_email: 'personal'
            });

            const res = await request({
                path: '/members_email',
                method: 'GET',
                query: { query: [user.id, withAccount.id, withUnusedAccount.id].join(',') },
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body).sort()).toEqual(['data', 'meta', 'success']);
            expect(res.body.meta).toEqual({ count: 3 });
            expect([...res.body.data].sort((a, b) => a.id - b.id)).toEqual([
                { id: user.id, notification_email: 'admin@example.com' },
                { id: withAccount.id, notification_email: 'some.one@aegee.eu' },
                { id: withUnusedAccount.id, notification_email: 'other.one@example.com' }
            ]);
        });

        test('should leave out the ids of members who do not exist', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

            const res = await request({
                path: '/members_email',
                method: 'GET',
                query: { query: user.id + ',2147483647' },
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                data: [{ id: user.id, notification_email: user.email }],
                meta: { count: 1 }
            });
        });

        test('should answer with an empty list if none of the members exist', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

            const res = await request({
                path: '/members_email',
                method: 'GET',
                query: { query: '2147483646,2147483647' },
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, data: [], meta: { count: 0 } });
        });

        test('should give each member once if an id is repeated', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });
            const otherUser = await generator.createUser();

            const res = await request({
                path: '/members_email',
                method: 'GET',
                query: { query: [otherUser.id, otherUser.id, otherUser.id].join(',') },
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([{ id: otherUser.id, notification_email: otherUser.email }]);
            expect(res.body.meta).toEqual({ count: 1 });
        });
    });
});
