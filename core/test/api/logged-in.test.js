const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('Logged in middleware', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if the token is not provided', async () => {
        const res = await request({
            path: '/members/me',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the token is invalid', async () => {
        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the token expires', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user, { expires_at: new Date() });
        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should not accept the token of a suspended member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        await user.update({ active: false });

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should not count a request with the token of a suspended member as activity', async () => {
        const user = await generator.createUser({ active: false });
        const token = await generator.createAccessToken(user);

        await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.last_active).toEqual(null);
    });

    test('should treat a suspended member as not logged in where logging in is optional', async () => {
        const user = await generator.createUser({ superadmin: true, active: false });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'view_deleted', object: 'body' });
        await generator.createBody({ type: 'antenna' });
        await generator.createBody({ type: 'working group' });

        // Without logging in only the antennae and contacts are listed.
        const list = await request({
            path: '/bodies',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(list.statusCode).toEqual(200);
        expect(list.body.data.length).toEqual(1);

        const all = await request({
            path: '/bodies?all=true',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(all.statusCode).toEqual(401);
    });

    test('should accept the token again after the suspension is lifted', async () => {
        const user = await generator.createUser({ active: false });
        const token = await generator.createAccessToken(user);
        await user.update({ active: true });

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
    });
});
