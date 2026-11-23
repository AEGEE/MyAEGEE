const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('My permissions for user', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should list the global permission that is assigned to a circle user is member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    test('should not list the local permissions that is assigned to a circle user is member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list the global permission that is assigned to a circle user is indirectly a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id });

        await generator.createCirclePermission(firstCircle, permission);
        await generator.createCircleMembership(thirdCircle, user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    test('should not list the global permission that is assigned to a circle user is not a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list a local permission for a body for direct circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const otherUser = await generator.createUser();

        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, user);
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('local:action:object');
    });

    test('should list a local permission for a body for a indirect circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser();

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id, body_id: body.id });

        await generator.createCirclePermission(firstCircle, permission);
        await generator.createCircleMembership(thirdCircle, user);
        await generator.createBodyMembership(body, user);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('local:action:object');
    });

    test('should list a join_request permission for a body for direct circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'join_request', action: 'action', object: 'object' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const otherUser = await generator.createUser();

        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, user);
        await generator.createJoinRequest(body, otherUser);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('join_request:action:object');
    });

    describe('where a local permission counts', () => {
        // A member of a circle of the body which has the local permission, like a board member.
        const createLocalHolder = async (body) => {
            const holder = await generator.createUser();
            const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
            const circle = await generator.createCircle({ body_id: body.id });
            await generator.createCirclePermission(circle, permission);
            await generator.createCircleMembership(circle, holder);
            await generator.createBodyMembership(body, holder);

            return { token: await generator.createAccessToken(holder), permission, circle };
        };

        const getPermissions = async (token, member) => {
            const res = await request({
                path: '/members/' + member.id + '/my_permissions',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body).sort()).toEqual(['data', 'success']);
            return res.body.data;
        };

        test('should be listed for a member of that body, with the circle that gives it', async () => {
            const body = await generator.createBody();
            const { token, permission, circle } = await createLocalHolder(body);
            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const rows = await getPermissions(token, member);

            expect(rows.length).toEqual(1);
            expect(rows[0]).toEqual(expect.objectContaining({
                id: permission.id,
                scope: 'local',
                action: 'action',
                object: 'object',
                combined: 'local:action:object'
            }));
            expect(rows[0].circle_permissions.map((item) => item.circle_id)).toEqual([circle.id]);
        });

        test('should not be listed for a member of another body', async () => {
            const body = await generator.createBody();
            const otherBody = await generator.createBody();
            const { token } = await createLocalHolder(body);
            const member = await generator.createUser();
            await generator.createBodyMembership(otherBody, member);

            expect(await getPermissions(token, member)).toEqual([]);
        });

        test('should not be listed for a member without a body', async () => {
            const body = await generator.createBody();
            const { token } = await createLocalHolder(body);
            const member = await generator.createUser();

            expect(await getPermissions(token, member)).toEqual([]);
        });

        test('should not be listed for somebody who only asked to join that body', async () => {
            const body = await generator.createBody();
            const { token } = await createLocalHolder(body);
            const member = await generator.createUser();
            await generator.createJoinRequest(body, member);

            expect(await getPermissions(token, member)).toEqual([]);
        });

        test('should be listed for a member who is in that body and in others', async () => {
            const body = await generator.createBody();
            const otherBody = await generator.createBody();
            const { token } = await createLocalHolder(body);
            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);
            await generator.createBodyMembership(otherBody, member);

            const rows = await getPermissions(token, member);

            expect(rows.map((row) => row.combined)).toEqual(['local:action:object']);
        });

        test('should be listed next to the global permissions of the caller', async () => {
            const body = await generator.createBody();
            const { token, circle } = await createLocalHolder(body);
            const globalPermission = await generator.createPermission({ scope: 'global', action: 'other', object: 'object' });
            await generator.createCirclePermission(circle, globalPermission);
            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const rows = await getPermissions(token, member);

            expect(rows.map((row) => row.combined).sort()).toEqual(['global:other:object', 'local:action:object']);
        });
    });

    test('should find the member by username', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        await generator.createUser({ username: 'someone' });

        const res = await request({
            path: '/members/SomeOne/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((row) => row.combined)).toEqual(['global:action:object']);
    });

    test('should not tell what the other member may do', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        // The permission belongs to the member who is asked about, not to the one who asks.
        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });
});
