const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Permission members', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the permission is not found', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/permissions/1337/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if id is not a number', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/permissions/xxx/members',
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
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission();

        const res = await request({
            path: '/permissions/' + permission.id + '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should list superadmins', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const permission = await generator.createPermission();

        const res = await request({
            path: '/permissions/' + permission.id + '/members',
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

    test('should list people who have this permission through free circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permissionCircle = await generator.createCircle();
        const viewPermission = await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createCircleMembership(permissionCircle, user);
        await generator.createCirclePermission(permissionCircle, viewPermission);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission();
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/permissions/' + permission.id + '/members',
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

    test('should list people who have this permission through bound circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permissionCircle = await generator.createCircle();
        const viewPermission = await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createCircleMembership(permissionCircle, user);
        await generator.createCirclePermission(permissionCircle, viewPermission);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission();
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/permissions/' + permission.id + '/members',
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

    test('should list people who have this permission through indirect circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permissionCircle = await generator.createCircle();
        const viewPermission = await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createCircleMembership(permissionCircle, user);
        await generator.createCirclePermission(permissionCircle, viewPermission);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission();
        const body = await generator.createBody();

        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ body_id: body.id, parent_circle_id: secondCircle.id });
        await generator.createCircleMembership(thirdCircle, otherUser);
        await generator.createCirclePermission(firstCircle, permission);

        const res = await request({
            path: '/permissions/' + permission.id + '/members',
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

    describe('counting and paging', () => {
        let token;
        let permission;
        let admin;
        let member;
        let circlesWithPermission;

        // An admin who is a superadmin, and a member who holds the permission through two circles
        // and is in a third circle that has nothing to do with it.
        beforeEach(async () => {
            admin = await generator.createUser({ superadmin: true, first_name: 'Aaa' });
            token = await generator.createAccessToken(admin);
            await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

            permission = await generator.createPermission();
            member = await generator.createUser({ first_name: 'Bbb' });
            const firstCircle = await generator.createCircle();
            const secondCircle = await generator.createCircle();
            const otherCircle = await generator.createCircle();
            for (const circle of [firstCircle, secondCircle, otherCircle]) {
                await generator.createCircleMembership(circle, member);
            }
            await generator.createCirclePermission(firstCircle, permission);
            await generator.createCirclePermission(secondCircle, permission);
            circlesWithPermission = [firstCircle, secondCircle];

            // Somebody without the permission.
            const stranger = await generator.createUser();
            await generator.createCircleMembership(otherCircle, stranger);
        });

        const list = (query) => request({
            path: '/permissions/' + permission.id + '/members',
            method: 'GET',
            query,
            headers: { 'X-Auth-Token': token.value }
        });

        test('should count each member once', async () => {
            const res = await list({ sort: 'first_name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((user) => user.id)).toEqual([admin.id, member.id]);
            expect(res.body.meta.count).toEqual(2);
        });

        test('should list all circles of each member, and the memberships that give the permission', async () => {
            const res = await list({ sort: 'first_name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data[0].circles).toEqual([]);
            expect(res.body.data[0].circle_memberships).toEqual([]);
            expect(res.body.data[1].circles.length).toEqual(3);
            expect(res.body.data[1].circle_memberships.map((membership) => membership.circle_id).sort())
                .toEqual(circlesWithPermission.map((circle) => circle.id).sort());
        });

        test('should respect limit and offset', async () => {
            const first = await list({ sort: 'first_name', limit: 1 });

            expect(first.statusCode).toEqual(200);
            expect(first.body.data.map((user) => user.id)).toEqual([admin.id]);
            expect(first.body.meta.count).toEqual(2);

            const second = await list({ sort: 'first_name', limit: 1, offset: 1 });

            expect(second.statusCode).toEqual(200);
            expect(second.body.data.map((user) => user.id)).toEqual([member.id]);
            expect(second.body.data[0].circles.length).toEqual(3);
            expect(second.body.meta.count).toEqual(2);
        });

        test('should find by name', async () => {
            const res = await list({ query: 'bbb' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((user) => user.id)).toEqual([member.id]);
            expect(res.body.meta.count).toEqual(1);
        });
    });
});
