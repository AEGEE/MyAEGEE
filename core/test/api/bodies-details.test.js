const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body details', () => {
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
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/bodies/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should find the body by code', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody({ code: 'xxx' });

        const res = await request({
            path: '/bodies/xxx',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });

    test('should find the body by username case-insensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody({ code: 'xxx' });

        const res = await request({
            path: '/bodies/XXX',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });

    test('should not treat % and _ in the code as wildcards', async () => {
        await generator.createBody({ code: 'xxx' });

        for (const code of ['%25', 'x%25', 'xx_', '___']) {
            const res = await request({
                path: '/bodies/' + code,
                method: 'GET'
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
        }
    });

    test('should find the body by id', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });

    test('should work for unauthorized user', async () => {
        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });

    test('should return 403 if not logged in on a deleted body', async () => {
        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 if no permissions on a deleted body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work for authorized user on a deleted body', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_deleted', object: 'body' });

        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });

    // The events, statutory, summer university and network services read these fields of a body.
    test.each([
        ['by id', (body) => body.id],
        ['by code', (body) => body.code]
    ])('should return the fields that other services read, %s', async (name, getKey) => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody({
            name: 'AEGEE-Somewhere',
            code: 'smw',
            type: 'contact antenna',
            email: 'Board@Somewhere.example.com'
        });

        const res = await request({
            path: '/bodies/' + getKey(body),
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({
            id: body.id,
            name: 'AEGEE-Somewhere',
            code: 'SMW',
            type: 'contact antenna',
            status: 'active',
            email: 'board@somewhere.example.com'
        });
    });
});
