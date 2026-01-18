const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body memberships list', () => {
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
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(membership.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const firstUser = await generator.createUser();
        await generator.createBodyMembership(body, firstUser);

        const membership = await generator.createBodyMembership(body, user);

        const thirdUser = await generator.createUser();
        await generator.createBodyMembership(body, thirdUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/members?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(membership.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();

        const firstUser = await generator.createUser();
        const firstMembership = await generator.createBodyMembership(body, firstUser);

        const secondUser = await generator.createUser();
        const secondMembership = await generator.createBodyMembership(body, secondUser);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        const res = await request({
            uri: '/bodies/' + body.id + '/members?sort=id&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondMembership.id);
        expect(res.body.data[1].id).toEqual(firstMembership.id);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const permission = await generator.createPermission({ scope: 'local', action: 'view_members', object: 'body' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find by user first name', async () => {
        const user = await generator.createUser({
            superadmin: true,
            first_name: 'aaa',
            last_name: 'zzz',
            email: 'test@test.io'
        });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        await generator.createUser({
            superadmin: true,
            first_name: 'zzz',
            last_name: 'zzz',
            email: 'test2@test.io'
        });

        const res = await request({
            uri: '/bodies/' + body.id + '/members?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(membership.id);
    });

    test('should find by user last name', async () => {
        const user = await generator.createUser({
            superadmin: true,
            first_name: 'zzz',
            last_name: 'aaa',
            email: 'test@test.io'
        });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        await generator.createUser({
            superadmin: true,
            first_name: 'zzz',
            last_name: 'zzz',
            email: 'test2@test.io'
        });

        const res = await request({
            uri: '/bodies/' + body.id + '/members?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(membership.id);
    });

    test('should find by user email', async () => {
        const user = await generator.createUser({
            superadmin: true,
            first_name: 'zzz',
            last_name: 'zzz',
            email: 'aaa@test.io'
        });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({ scope: 'global', action: 'view_members', object: 'body' });

        await generator.createUser({
            superadmin: true,
            first_name: 'zzz',
            last_name: 'zzz',
            email: 'test@test.io'
        });

        const res = await request({
            uri: '/bodies/' + body.id + '/members?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(membership.id);
    });
});
