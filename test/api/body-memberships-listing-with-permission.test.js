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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { action: 'action', object: 'object' } },
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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { object: 'object' } },
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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { action: 'action' } },
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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { action: 'action', object: 'object' } },
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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { action: 'action', object: 'object' } },
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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { action: 'action', object: 'object' } },
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
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            qs: { holds_permission: { action: 'action', object: 'object' } },
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(0);
    });
});
