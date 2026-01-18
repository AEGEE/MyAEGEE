const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Circle, BodyMembership, JoinRequest, Payment } = require('../../models');

describe('Bodies status', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the body is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const res = await request({
            uri: '/bodies/1337/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'aaa' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');
    });

    test('should fail if no permissions', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'aaa' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if new status is deleted', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'deleted' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.status).toEqual('deleted');
    });

    test('should succeed if new status is active', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'active' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.status).toEqual('active');
    });

    test('should remove all stuff from body once deleted', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'body' });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });

        await generator.createJoinRequest(body, user);
        await generator.createCircleMembership(circle, user);
        await generator.createBodyMembership(body, user);
        await generator.createPayment(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'deleted' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.status).toEqual('deleted');

        expect(await Circle.count({ where: { body_id: body.id } })).toEqual(0);
        expect(await BodyMembership.count({ where: { body_id: body.id } })).toEqual(0);
        expect(await JoinRequest.count({ where: { body_id: body.id } })).toEqual(0);
        expect(await Payment.count({ where: { body_id: body.id } })).toEqual(0);
    });
});
