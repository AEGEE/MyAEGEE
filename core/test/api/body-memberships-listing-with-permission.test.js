const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body memberships list wth permission', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if no view:member permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action', object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should complain if no action is specified', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should complain if no object is specified', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if no permission found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action', object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should list member who got this permission from a bound circle directly', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const body = await generator.createBody();
        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const circle = await generator.createCircle({ body_id: body.id });
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action', object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].user.id).toEqual(otherUser.id);
    });

    test('should list member who got this permission from a bound circle indirectly', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const body = await generator.createBody();
        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });

        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id, body_id: body.id });

        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(thirdCircle, otherUser);
        await generator.createCirclePermission(firstCircle, permission);

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action', object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].user.id).toEqual(otherUser.id);
    });

    test('should not list member if member has this permission over other body', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const baseCircle = await generator.createCircle();
        await generator.createCirclePermission(baseCircle, permission);

        const body = await generator.createBody();
        const otherBody = await generator.createBody();
        await generator.createCircle({ body_id: body.id, parent_circle_id: baseCircle.id });
        const otherCircle = await generator.createCircle({ body_id: otherBody.id, parent_circle_id: baseCircle.id });

        const otherUser = await generator.createUser();

        await generator.createBodyMembership(body, otherUser);
        await generator.createBodyMembership(otherBody, otherUser);
        await generator.createCircleMembership(otherCircle, otherUser);

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action', object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(0);
    });

    describe('counting and paging', () => {
        let token;
        let body;
        let first;
        let second;
        let circles;

        // Two members hold the permission: the first one through two circles of the body.
        beforeEach(async () => {
            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

            body = await generator.createBody();
            const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
            circles = [
                await generator.createCircle({ body_id: body.id }),
                await generator.createCircle({ body_id: body.id })
            ];
            const circleWithoutPermission = await generator.createCircle({ body_id: body.id });
            for (const circle of circles) {
                await generator.createCirclePermission(circle, permission);
            }

            first = await generator.createUser({ first_name: 'Aaa' });
            second = await generator.createUser({ first_name: 'Bbb' });
            const third = await generator.createUser({ first_name: 'Ccc' });
            for (const member of [first, second, third]) {
                await generator.createBodyMembership(body, member);
                await generator.createCircleMembership(circleWithoutPermission, member);
            }
            await generator.createCircleMembership(circles[0], first);
            await generator.createCircleMembership(circles[1], first);
            await generator.createCircleMembership(circles[1], second);
        });

        const list = (query = {}) => request({
            path: '/bodies/' + body.id + '/members',
            method: 'GET',
            query: { holds_permission: { action: 'action', object: 'object' }, ...query },
            headers: { 'X-Auth-Token': token.value }
        });

        test('should count each member once', async () => {
            const res = await list();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((membership) => membership.user_id)).toEqual([first.id, second.id]);
            expect(res.body.meta.count).toEqual(2);
        });

        test('should list the circles through which each member holds the permission', async () => {
            const res = await list();

            expect(res.statusCode).toEqual(200);

            const circleIds = (membership) => membership.user.circle_memberships.map((m) => m.circle_id).sort();
            expect(circleIds(res.body.data[0])).toEqual(circles.map((circle) => circle.id).sort());
            expect(circleIds(res.body.data[1])).toEqual([circles[1].id]);
            expect(res.body.data[0].user.circle_memberships[0].circle.body_id).toEqual(body.id);
        });

        test('should respect limit and offset', async () => {
            const firstPage = await list({ limit: 1 });

            expect(firstPage.statusCode).toEqual(200);
            expect(firstPage.body.data.map((membership) => membership.user_id)).toEqual([first.id]);
            expect(firstPage.body.data[0].user.circle_memberships.length).toEqual(2);
            expect(firstPage.body.meta.count).toEqual(2);

            const secondPage = await list({ limit: 1, offset: 1 });

            expect(secondPage.statusCode).toEqual(200);
            expect(secondPage.body.data.map((membership) => membership.user_id)).toEqual([second.id]);
            expect(secondPage.body.meta.count).toEqual(2);
        });

        test('should find by name', async () => {
            const res = await list({ query: 'bbb' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((membership) => membership.user_id)).toEqual([second.id]);
            expect(res.body.meta.count).toEqual(1);
        });
    });
});
