const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Users list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const member = await generator.createUser();
        await generator.createUser();

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const res = await request({
            path: '/members_search?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(member.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const firstUser = await generator.createUser({
            first_name: 'aaa',
            mail_confirmed_at: new Date(),
            superadmin: true
        });
        const token = await generator.createAccessToken(firstUser);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const secondUser = await generator.createUser({ first_name: 'bbb' });

        const res = await request({
            path: '/members_search?sort=first_name&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondUser.id);
        expect(res.body.data[1].id).toEqual(firstUser.id);
    });

    test('should find by first_name', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'aaa', last_name: 'bbb', email: 'ccc@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members_search?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find by last_name', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'aaa', email: 'ccc@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members_search?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find by email', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'aaa@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members_search?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should only return certain fields (with GSuite ID)', async () => {
        const user = await generator.createUser({ superadmin: true, gsuite_id: 'test@aegee.eu' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const expectedOutput = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            gsuite_id: user.gsuite_id
        };

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expectedOutput);
    });

    test('should only return certain fields (without GSuite ID)', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const expectedOutput = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            gsuite_id: user.gsuite_id
        };

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expectedOutput);
    });

    test('should filter by body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const body = await generator.createBody();
        const memberInBody = await generator.createUser();
        await generator.createBodyMembership(body, memberInBody);

        const memberNotInBody = await generator.createUser();

        const res = await request({
            path: '/members_search?body_id=' + body.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        const returnedIds = res.body.data.map((u) => u.id);
        expect(returnedIds).toContain(memberInBody.id);
        expect(returnedIds).not.toContain(memberNotInBody.id);
        expect(returnedIds).not.toContain(user.id);
    });

    test('should filter by multiple body_ids', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const body1 = await generator.createBody();
        const body2 = await generator.createBody();
        const memberInBody1 = await generator.createUser();
        const memberInBody2 = await generator.createUser();
        await generator.createBodyMembership(body1, memberInBody1);
        await generator.createBodyMembership(body2, memberInBody2);

        const memberNotInAnyBody = await generator.createUser();

        const res = await request({
            path: '/members_search?body_id=' + body1.id + ',' + body2.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const returnedIds = res.body.data.map((u) => u.id);
        expect(returnedIds).toContain(memberInBody1.id);
        expect(returnedIds).toContain(memberInBody2.id);
        expect(returnedIds).not.toContain(memberNotInAnyBody.id);
    });

    test('should not duplicate users in multiple bodies when filtering by body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const body1 = await generator.createBody();
        const body2 = await generator.createBody();
        const memberInBothBodies = await generator.createUser();
        await generator.createBodyMembership(body1, memberInBothBodies);
        await generator.createBodyMembership(body2, memberInBothBodies);

        const res = await request({
            path: '/members_search?body_id=' + body1.id + ',' + body2.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const matchingUsers = res.body.data.filter((u) => u.id === memberInBothBodies.id);
        expect(matchingUsers.length).toEqual(1);
        expect(res.body.meta.count).toEqual(1);
    });

    test('should combine body_id filter with query search', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const body = await generator.createBody();
        const matchingMember = await generator.createUser({ first_name: 'TestSearchName' });
        const nonMatchingMember = await generator.createUser({ first_name: 'OtherName' });
        await generator.createBodyMembership(body, matchingMember);
        await generator.createBodyMembership(body, nonMatchingMember);

        const res = await request({
            path: '/members_search?body_id=' + body.id + '&query=TestSearchName',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(matchingMember.id);
    });

    test('should ignore invalid body_id values', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });

        const res = await request({
            path: '/members_search?body_id=invalid,nonsense',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        // With all invalid IDs filtered out, it should behave like no body_id filter (return all)
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });
});
