const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body membership editing', () => {
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
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_member', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members/lalala',
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
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_member', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members/1337',
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

        const body = await generator.createBody();
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'update_member', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { comment: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.comment).toEqual('test');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const membership = await generator.createBodyMembership(body, user);

        const permission = await generator.createPermission({ scope: 'local', action: 'update_member', object: 'body' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id + '/members/' + membership.id,
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

        const body = await generator.createBody();
        const membership = await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { comment: 'test' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
