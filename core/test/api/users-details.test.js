const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('User details', () => {
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

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members/2147483647',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should find the user by username', async () => {
        const user = await generator.createUser({ superadmin: true, username: 'test' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members/test',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should find the user by username case-insensitive', async () => {
        const user = await generator.createUser({ superadmin: true, username: 'test' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members/TEST',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should not treat % and _ in the username as wildcards', async () => {
        const user = await generator.createUser({ superadmin: true, username: 'test' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        for (const username of ['te%25', '%25', 'tes_', '____']) {
            const res = await request({
                path: '/members/' + username,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
        }
    });

    test('should find the exact username if another one only differs where it has an underscore', async () => {
        const viewer = await generator.createUser({ superadmin: true, username: 'somexone' });
        const user = await generator.createUser({ username: 'some_one' });
        const token = await generator.createAccessToken(viewer);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members/some_one',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should find the user by id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members/' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('work for the current user for /me without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('work for the current user for /:user_id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(user.id);
    });

    test('should work with join_request permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'join_request', action: 'view', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createJoinRequest(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(otherUser.id);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'view', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(otherUser.id);
    });

    test('should work with global view_members permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(otherUser.id);
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail with search permission on regular member details', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail member lookup data with only search permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/lookup',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return limited member lookup data with lookup permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'lookup', object: 'member' });
        const otherUser = await generator.createUser({ gsuite_id: 'example-organizer@aegee.eu' });

        const res = await request({
            path: '/members/' + otherUser.id + '/lookup',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data).toEqual({
            id: otherUser.id,
            first_name: otherUser.first_name,
            last_name: otherUser.last_name,
            username: otherUser.username,
            email: otherUser.email,
            gsuite_id: otherUser.gsuite_id,
            notification_email: otherUser.notification_email
        });
    });

    test('should fail member lookup data without lookup permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/lookup',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('the short answer for holders of view_members:body', () => {
        test('should have the id, the names and the addresses, and nothing else', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

            const body = await generator.createBody();
            const otherUser = await generator.createUser({
                first_name: 'Some',
                last_name: 'One',
                email: 'some.one@example.com'
            });
            await generator.createBodyMembership(body, otherUser);

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                data: {
                    id: otherUser.id,
                    first_name: 'Some',
                    last_name: 'One',
                    email: 'some.one@example.com',
                    notification_email: 'some.one@example.com'
                }
            });
        });

        test('should have the Google Workspace account as the notification address if that is the primary email', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

            const otherUser = await generator.createUser({
                email: 'some.one@example.com',
                gsuite_id: 'example-some.one@aegee.eu',
                primary_email: 'gsuite'
            });

            const res = await request({
                path: '/members/' + otherUser.username,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body.data).sort()).toEqual(['email', 'first_name', 'id', 'last_name', 'notification_email']);
            expect(res.body.data.email).toEqual('some.one@example.com');
            expect(res.body.data.notification_email).toEqual('example-some.one@aegee.eu');
        });

        test('should be given to a holder of the local permission for a member of that body', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });
            const permission = await generator.createPermission({ scope: 'local', action: 'view_members', object: 'body' });
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);

            const otherUser = await generator.createUser();
            await generator.createBodyMembership(body, otherUser);

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({
                id: otherUser.id,
                first_name: otherUser.first_name,
                last_name: otherUser.last_name,
                email: otherUser.email,
                notification_email: otherUser.email
            });
        });

        test('should not have the event application ban of the member', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });
            await generator.createPermission({ scope: 'global', action: 'update_application_ban', object: 'member' });

            const otherUser = await generator.createUser();
            await generator.createEventApplicationBan(otherUser, user);

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body.data).sort()).toEqual(['email', 'first_name', 'id', 'last_name', 'notification_email']);
        });

        test('should give way to the whole member for a holder of view:member as well', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });
            await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

            const otherUser = await generator.createUser();

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.username).toEqual(otherUser.username);
            expect(res.body.data).toHaveProperty('bodies');
        });

        test('should give way to the whole member for the member themselves', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const circle = await generator.createCircle();
            const permission = await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);

            const res = await request({
                path: '/members/' + user.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.username).toEqual(user.username);
            expect(res.body.data).toHaveProperty('circles');
        });
    });

    test('should name the permission that is needed for another member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Permission view:member is required, but not present.' });
    });

    describe('the own profile', () => {
        // What the other services read of the member who calls them.
        test('should have what the other services read, for /me and for the own id', async () => {
            const antenna = await generator.createBody({ name: 'AEGEE-Somewhere', code: 'SMW', type: 'antenna' });
            const contact = await generator.createBody({ name: 'AEGEE-Elsewhere', code: 'ELS', type: 'contact' });
            const user = await generator.createUser({
                first_name: 'Some',
                last_name: 'One',
                email: 'some.one@example.com',
                gender: 'other',
                date_of_birth: '1995-03-17'
            });
            await generator.createBodyMembership(antenna, user);
            await generator.createBodyMembership(contact, user);
            const token = await generator.createAccessToken(user);

            for (const id of ['me', user.id, user.username]) {
                const res = await request({
                    path: '/members/' + id,
                    method: 'GET',
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(200);
                expect(Object.keys(res.body).sort()).toEqual(['data', 'success']);
                expect(res.body.data).toEqual(expect.objectContaining({
                    id: user.id,
                    first_name: 'Some',
                    last_name: 'One',
                    notification_email: 'some.one@example.com',
                    gender: 'other',
                    date_of_birth: '1995-03-17',
                    superadmin: false
                }));

                const bodies = res.body.data.bodies
                    .map((body) => ({
                        id: body.id,
                        name: body.name,
                        code: body.code,
                        type: body.type,
                        status: body.status
                    }))
                    .sort((a, b) => a.id - b.id);
                expect(bodies).toEqual([
                    { id: antenna.id, name: 'AEGEE-Somewhere', code: 'SMW', type: 'antenna', status: 'active' },
                    { id: contact.id, name: 'AEGEE-Elsewhere', code: 'ELS', type: 'contact', status: 'active' }
                ]);
            }
        });

        test('should not have the password', async () => {
            const user = await generator.createUser({ password: 'a-secret-password' });
            const token = await generator.createAccessToken(user);
            const userFromDb = await User.scope('withPassword').findByPk(user.id);

            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).not.toHaveProperty('password');
            expect(JSON.stringify(res.body)).not.toContain(userFromDb.password);
            expect(JSON.stringify(res.body)).not.toContain('a-secret-password');
        });

        test('should have the memberships, join requests, circles and the primary body of the member', async () => {
            const body = await generator.createBody();
            const otherBody = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });
            const user = await generator.createUser();
            const membership = await generator.createBodyMembership(body, user);
            const joinRequest = await generator.createJoinRequest(otherBody, user);
            await generator.createCircleMembership(circle, user);
            await user.update({ primary_body_id: body.id });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.primary_body_id).toEqual(body.id);
            expect(res.body.data.primary_body.id).toEqual(body.id);
            expect(res.body.data.bodies.map((item) => item.id)).toEqual([body.id]);
            expect(res.body.data.body_memberships.map((item) => item.id)).toEqual([membership.id]);
            expect(res.body.data.join_requests.map((item) => item.id)).toEqual([joinRequest.id]);
            expect(res.body.data.join_requests[0].body_id).toEqual(otherBody.id);
            expect(res.body.data.circles.map((item) => item.id)).toEqual([circle.id]);
            expect(res.body.data.event_application_ban).toBeNull();
        });

        test('should count as activity of the member', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const before = Date.now();
            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.last_active.getTime()).toBeGreaterThanOrEqual(before - 1000);
        });
    });

    describe('member lookup', () => {
        test.each(['me', 'id', 'username'])('should work for the member themselves without permission (addressed by %s)', async (addressedBy) => {
            const user = await generator.createUser({
                username: 'someone',
                first_name: 'Some',
                last_name: 'One',
                email: 'some.one@example.com'
            });
            const token = await generator.createAccessToken(user);
            const id = { me: 'me', id: user.id, username: 'someone' }[addressedBy];

            const res = await request({
                path: '/members/' + id + '/lookup',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                data: {
                    id: user.id,
                    first_name: 'Some',
                    last_name: 'One',
                    username: 'someone',
                    email: 'some.one@example.com',
                    gsuite_id: null,
                    notification_email: 'some.one@example.com'
                }
            });
        });

        test('should work with the view:member permission', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
            const otherUser = await generator.createUser({ gsuite_id: 'example-organizer@aegee.eu', primary_email: 'gsuite' });

            const res = await request({
                path: '/members/' + otherUser.id + '/lookup',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({
                id: otherUser.id,
                first_name: otherUser.first_name,
                last_name: otherUser.last_name,
                username: otherUser.username,
                email: otherUser.email,
                gsuite_id: 'example-organizer@aegee.eu',
                notification_email: 'example-organizer@aegee.eu'
            });
        });

        test('should work with the local lookup permission for a member of that body', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });
            const permission = await generator.createPermission({ scope: 'local', action: 'lookup', object: 'member' });
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);

            const otherUser = await generator.createUser();
            await generator.createBodyMembership(body, otherUser);

            const res = await request({
                path: '/members/' + otherUser.id + '/lookup',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(otherUser.id);
        });

        test('should not work with only view_members:body', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });
            const otherUser = await generator.createUser();

            const res = await request({
                path: '/members/' + otherUser.id + '/lookup',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'Permission lookup:member is required, but not present.' });
        });
    });
});
