const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { CircleMembership } = require('../../models');

describe('Circle membership editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 400 if the membership_id is invalid', async () => {
        const circle = await generator.createCircle();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_members', object: 'circle' });

        const res = await request({
            path: '/circles/' + circle.id + '/members/lalala',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the membership is not found', async () => {
        const circle = await generator.createCircle();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_members', object: 'circle' });

        const res = await request({
            path: '/circles/' + circle.id + '/members/2147483647',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const membership = await generator.createCircleMembership(circle, user);

        await generator.createPermission({ scope: 'global', action: 'update_members', object: 'circle' });

        const res = await request({
            path: '/circles/' + circle.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { position: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.position).toEqual('test');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const permission = await generator.createPermission({ scope: 'local', action: 'update_members', object: 'circle' });
        const circle = await generator.createCircle({ body_id: body.id });
        const membership = await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/circles/' + circle.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { comment: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const membership = await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/circles/' + circle.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { comment: 'test' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test.each([
        ['an object', { name: 'Treasurer' }],
        ['a list', ['Treasurer']]
    ])('should fail if the position is %s, and keep the position it had', async (name, position) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const membership = await generator.createCircleMembership(circle, user);
        await membership.update({ position: 'President' });

        await generator.createPermission({ scope: 'global', action: 'update_members', object: 'circle' });

        const res = await request({
            path: '/circles/' + circle.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { position }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({
            success: false,
            errors: { position: ['position cannot be an array or an object'] }
        });

        const membershipFromDb = await CircleMembership.findByPk(membership.id);
        expect(membershipFromDb.position).toEqual('President');
    });

    test('should remove the position if it is null', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const membership = await generator.createCircleMembership(circle, user);
        await membership.update({ position: 'President' });

        await generator.createPermission({ scope: 'global', action: 'update_members', object: 'circle' });

        const res = await request({
            path: '/circles/' + circle.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { position: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.position).toEqual(null);

        const membershipFromDb = await CircleMembership.findByPk(membership.id);
        expect(membershipFromDb.position).toEqual(null);
    });
});
