const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { JoinRequest, BodyMembership, CircleMembership } = require('../../models');
const mock = require('../scripts/mock');

describe('Join request status', () => {
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

    test('should return 400 if the request_id is invalid', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/lalala/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the join request is not found', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/1337/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the status is invalid', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'unknown' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the status is not pending', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const body = await generator.createBody();
        const joinRequest = await JoinRequest.create({
            body_id: body.id,
            user_id: user.id,
            status: 'approved'
        });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'rejected' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay and the status is rejected', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'rejected' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const joinRequestFromDb = await JoinRequest.findByPk(joinRequest.id);
        expect(joinRequestFromDb).toEqual(null);
    });

    test('should succeed if everything is okay and the status is accepted', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const joinRequestFromDb = await JoinRequest.findByPk(joinRequest.id);
        expect(joinRequestFromDb).not.toEqual(null);

        const membershipFromDb = await BodyMembership.findOne({
            where: {
                user_id: user.id,
                body_id: body.id
            }
        });
        expect(membershipFromDb).not.toEqual(null);
    });

    test('should add the person to a shadow circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const body = await generator.createBody({ shadow_circle_id: circle.id });
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await CircleMembership.findOne({
            where: {
                circle_id: circle.id,
                user_id: user.id
            }
        });
        expect(membershipFromDb).not.toEqual(null);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
