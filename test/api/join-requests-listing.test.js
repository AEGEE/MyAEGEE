const { startServer, stopServer } = require('../../lib/server');
const { JoinRequest } = require('../../models');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Join requests list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const firstUser = await generator.createUser();
        await generator.createJoinRequest(body, firstUser);

        const joinRequest = await generator.createJoinRequest(body, user);

        const thirdUser = await generator.createUser();
        await generator.createJoinRequest(body, thirdUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        const firstUser = await generator.createUser();
        const firstJoinRequest = await generator.createJoinRequest(body, firstUser);

        const secondUser = await generator.createUser();
        const secondJoinRequest = await generator.createJoinRequest(body, secondUser);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?sort=id&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondJoinRequest.id);
        expect(res.body.data[1].id).toEqual(firstJoinRequest.id);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        const permission = await generator.createPermission({ scope: 'local', action: 'view', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find by user first name', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const user1 = await generator.createUser({ first_name: 'aaa', last_name: 'zzz', email: 'zzz@test.io' });
        const joinRequest = await generator.createJoinRequest(body, user1);

        const user2 = await generator.createUser({ first_name: 'bbb', last_name: 'zzz', email: 'zzz2@test.io' });
        await generator.createJoinRequest(body, user2);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });

    test('should find by user last name', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const user1 = await generator.createUser({ first_name: 'zzz', last_name: 'aaa', email: 'zzz@test.io' });
        const joinRequest = await generator.createJoinRequest(body, user1);

        const user2 = await generator.createUser({ first_name: 'zzz', last_name: 'bbb', email: 'zzz2@test.io' });
        await generator.createJoinRequest(body, user2);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });

    test('should find by user email', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const user1 = await generator.createUser({ first_name: 'zzz', last_name: 'zzz', email: 'aaa@test.io' });
        const joinRequest = await generator.createJoinRequest(body, user1);

        const user2 = await generator.createUser({ first_name: 'zzz', last_name: 'zzz', email: 'bbb@test.io' });
        await generator.createJoinRequest(body, user2);

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });

    test('should filter by status', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const user1 = await generator.createUser();
        const joinRequest = await JoinRequest.create({
            body_id: body.id,
            user_id: user1.id,
            status: 'approved'
        });

        const user2 = await generator.createUser();
        await JoinRequest.create({
            body_id: body.id,
            user_id: user2.id
        });

        await generator.createPermission({ scope: 'global', action: 'view', object: 'join_request' });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?status=approved',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });
});
