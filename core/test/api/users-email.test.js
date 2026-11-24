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

    test('should fail without query', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find own by id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + user.id,
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

    test('should refuse ids other than the own one without permission', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + user.id + ',' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should refuse ids other than the own one without permission, whatever the order', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + secondUser.id + ',' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should find own by id without permission if the id is repeated', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_email?query=' + user.id + ',' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find own and other ids with the permission', async () => {
        const user = await generator.createUser();
        const secondUser = await generator.createUser();
        const thirdUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members_email?query=' + [secondUser.id, user.id, thirdUser.id].join(','),
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.map((row) => row.id).sort()).toEqual([user.id, secondUser.id, thirdUser.id].sort());
    });

    test('should find one by id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(secondUser.id);
    });

    test('should find multiple by id array', async () => {
        const user = await generator.createUser({ superadmin: true });
        const secondUser = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=' + user.id + ',' + secondUser.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect([user.id, secondUser.id]).toContainEqual(res.body.data[0].id);
        expect([user.id, secondUser.id]).toContainEqual(res.body.data[1].id);
    });

    test('should fail when query is not a string of ids seperated by commas', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=a,b',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should refuse ids that no member can have', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        for (const query of ['2147483648', '99999999999999999999', `${user.id},2147483648`, '0', `${user.id},0`]) {
            const res = await request({
                path: '/members_email',
                query: { query },
                headers: { 'X-Auth-Token': token.value }
            });

            expect({ query, status: res.statusCode, message: res.body.message }).toEqual({
                query,
                status: 400,
                message: 'Query should be a string of 1 id or multiple ids seperated by commas.'
            });
        }
    });

    test('should only return id and notification email', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'mail', object: 'member' });

        const res = await request({
            path: '/members_email?query=' + user.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const expectedOutput = {
            id: user.id,
            notification_email: user.notification_email
        };

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expectedOutput);
    });
});
