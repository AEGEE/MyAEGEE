const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { CircleMembership } = require('../../models');

describe('Circle memberships creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 400 if the user_id is invalid', async () => {
        const currentUser = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(currentUser);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });

        const circle = await generator.createCircle();

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: 'lalala' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the user is not found', async () => {
        const currentUser = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(currentUser);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });

        const circle = await generator.createCircle();

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: 2147483647 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the user is not a member of a body', async () => {
        const currentUser = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(currentUser);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser();

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay for a bound circle', async () => {
        const currentUser = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(currentUser);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should fail if no permission', async () => {
        const currentUser = await generator.createUser();
        const token = await generator.createAccessToken(currentUser);

        const circle = await generator.createCircle();
        const user = await generator.createUser();

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay for a free circle', async () => {
        const currentUser = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(currentUser);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });

        const circle = await generator.createCircle();
        const user = await generator.createUser();

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should work with local permission', async () => {
        const currentUser = await generator.createUser();
        const token = await generator.createAccessToken(currentUser);

        const permission = await generator.createPermission({ scope: 'local', action: 'add_member', object: 'circle' });

        const body = await generator.createBody();
        const permissionCircle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, currentUser);
        await generator.createCircleMembership(permissionCircle, currentUser);
        await generator.createCirclePermission(permissionCircle, permission);

        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test.each([
        ['missing', undefined],
        ['a text that is not a number', 'abc'],
        ['an empty text', ''],
        ['a list', [1]],
        ['an object', { id: 1 }],
        ['a fraction', 1.5],
        ['a boolean', true],
        ['null', null]
    ])('should return 400 if the user id is %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });
        const circle = await generator.createCircle();

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The user ID is not valid.' });
    });

    test.each([
        ['a free circle', false],
        ['a circle of a body', true]
    ])('should fail for a member of %s who is in it already, and keep the one membership', async (name, bound) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'circle' });

        const member = await generator.createUser();
        const body = await generator.createBody();
        await generator.createBodyMembership(body, member);

        const circle = await generator.createCircle(bound ? { body_id: body.id } : {});
        const membership = await generator.createCircleMembership(circle, member);
        await membership.update({ position: 'Treasurer' });

        const res = await request({
            path: '/circles/' + circle.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: member.id }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({
            success: false,
            errors: { circle_id: ['circle_id must be unique'], user_id: ['user_id must be unique'] }
        });

        const memberships = await CircleMembership.findAll({ where: { circle_id: circle.id } });
        expect(memberships.map((item) => [item.id, item.user_id, item.position])).toEqual([[membership.id, member.id, 'Treasurer']]);
    });
});
