const { startServer, stopServer } = require('../../lib/server');
const { CircleMembership } = require('../../models');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

describe('Body membership creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should return 404 if the user is not found', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: 1337 }
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

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(user.id);
        expect(res.body.data.body_id).toEqual(body.id);
    });

    test('should add a person to shadow circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const shadowCircle = await generator.createCircle();
        const body = await generator.createBody({ shadow_circle_id: shadowCircle.id });
        await shadowCircle.update({ body_id: body.id });

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(user.id);
        expect(res.body.data.body_id).toEqual(body.id);

        const membership = await CircleMembership.findOne({
            where: {
                circle_id: shadowCircle.id,
                user_id: user.id
            }
        });

        expect(membership).not.toEqual(null);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const permission = await generator.createPermission({ scope: 'local', action: 'add_member', object: 'body' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const otherUser = await generator.createUser();

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: otherUser.id }
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

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
