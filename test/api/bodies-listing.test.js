const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Bodies list', () => {
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
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(body.id);

        expect(res.body.meta.count).toEqual(1);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        // Adding name to make sure sorting is correct
        await generator.createBody({ name: 'AAA' });
        const body = await generator.createBody({ name: 'BBB' });
        await generator.createBody({ name: 'CCC' });

        const res = await request({
            uri: '/bodies?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(body.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ code: 'AAA' });
        const secondBody = await generator.createBody({ code: 'BBB' });

        const res = await request({
            uri: '/bodies?sort=code&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondBody.id);
        expect(res.body.data[1].id).toEqual(firstBody.id);
    });

    test('should find body by name case-sensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'AAA' });
        await generator.createBody({ name: 'BBB' });

        const res = await request({
            uri: '/bodies?query=AAA', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find body by name case-insensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'AAA' });
        await generator.createBody({ name: 'BBB' });

        const res = await request({
            uri: '/bodies?query=aaa', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find body by code case-sensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'ZZZ', code: 'AAA' });
        await generator.createBody({ name: 'ZZZ', code: 'BBB' });

        const res = await request({
            uri: '/bodies?query=AAA', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find body by code case-sensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'ZZZ', code: 'AAA' });
        await generator.createBody({ name: 'ZZZ', code: 'BBB' });

        const res = await request({
            uri: '/bodies?query=aaa', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find by part of the name/code', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'aaa', code: 'aaa' });
        await generator.createBody({ name: 'bbb', code: 'bbb' });

        const res = await request({
            uri: '/bodies?query=a', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should filter deleted bodies on /bodies', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createBody({ status: 'deleted' });

        const res = await request({
            uri: '/bodies',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(0);
    });

    test('should return 401 if not authorized on /bodies?all=true', async () => {
        const res = await request({
            uri: '/bodies?all=true',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 if no permission on /bodies?all=true', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/bodies?all=true',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should not filter deleted bodies on /bodies?all=true', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_deleted', object: 'body' });

        await generator.createBody({ status: 'deleted' });

        const res = await request({
            uri: '/bodies?all=true',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
    });
});
