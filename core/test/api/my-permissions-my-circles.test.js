const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Listing my circles for permission', () => {
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
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if action is not provided', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { object: 'object' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if object is not provided', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return empty list if the permission is not attached', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(0);
    });

    test('should return free circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(circle.id);
    });

    test('should return bound circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(circle.id);
    });

    test('should return bound indirect circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const body = await generator.createBody();

        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id, body_id: body.id });

        await generator.createCirclePermission(firstCircle, permission);
        await generator.createCircleMembership(thirdCircle, user);

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(thirdCircle.id);
    });

    test('should not return a circle you are not a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const parentCircle = await generator.createCircle();
        const childCircle = await generator.createCircle({ parent_circle_id: parentCircle.id });
        const otherChildCircle = await generator.createCircle({ parent_circle_id: parentCircle.id });

        const otherUser = await generator.createUser();

        await generator.createCirclePermission(parentCircle, permission);
        await generator.createCircleMembership(childCircle, user);
        await generator.createCircleMembership(otherChildCircle, otherUser);

        const res = await request({
            path: '/my_permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(childCircle.id);
    });

    describe('counting and paging', () => {
        let token;
        let user;
        let circles;

        // The permission is attached to two circles the member is in, and to one they are not in.
        beforeEach(async () => {
            user = await generator.createUser();
            token = await generator.createAccessToken(user);

            const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
            const body = await generator.createBody();
            circles = [
                await generator.createCircle({ body_id: body.id, name: 'Aaa' }),
                await generator.createCircle({ body_id: body.id, name: 'Bbb' })
            ];
            const otherCircle = await generator.createCircle({ body_id: body.id, name: 'Ccc' });
            for (const circle of [...circles, otherCircle]) {
                await generator.createCirclePermission(circle, permission);
            }
            for (const circle of circles) {
                await generator.createCircleMembership(circle, user);
            }

            const otherUser = await generator.createUser();
            for (const circle of [...circles, otherCircle]) {
                await generator.createCircleMembership(circle, otherUser);
            }
        });

        const list = (query = {}) => request({
            path: '/my_permissions',
            method: 'POST',
            query: { sort: 'name', ...query },
            headers: { 'X-Auth-Token': token.value },
            body: { action: 'action', object: 'object' }
        });

        test('should count each circle once and list the own membership of each', async () => {
            const res = await list();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((circle) => circle.id)).toEqual(circles.map((circle) => circle.id));
            expect(res.body.meta.count).toEqual(2);

            for (const circle of res.body.data) {
                expect(circle.circle_memberships.map((membership) => membership.user_id)).toEqual([user.id]);
            }
        });

        test('should respect limit and offset', async () => {
            const firstPage = await list({ limit: 1 });

            expect(firstPage.statusCode).toEqual(200);
            expect(firstPage.body.data.map((circle) => circle.id)).toEqual([circles[0].id]);
            expect(firstPage.body.meta.count).toEqual(2);

            const secondPage = await list({ limit: 1, offset: 1 });

            expect(secondPage.statusCode).toEqual(200);
            expect(secondPage.body.data.map((circle) => circle.id)).toEqual([circles[1].id]);
            expect(secondPage.body.data[0].circle_memberships.length).toEqual(1);
            expect(secondPage.body.meta.count).toEqual(2);
        });

        test('should find by name', async () => {
            const res = await list({ query: 'bbb' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((circle) => circle.id)).toEqual([circles[1].id]);
            expect(res.body.meta.count).toEqual(1);
        });
    });

    test.each([
        ['a number', 5],
        ['a list', ['process']],
        ['an object', { a: 1 }],
        ['a boolean', true]
    ])('should return 400 if the action or the object is %s', async (name, value) => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });

        for (const body of [{ action: value, object: 'object' }, { action: 'action', object: value }]) {
            const res = await request({
                path: '/my_permissions',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'Action or object is not specified.' });
        }
    });
});
