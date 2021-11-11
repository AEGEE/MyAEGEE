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
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/bodies/1337',
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
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody({ code: 'xxx' });

        const res = await request({
            uri: '/bodies/xxx',
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
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody({ code: 'xxx' });

        const res = await request({
            uri: '/bodies/XXX',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });

    test('should find the body by id', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id,
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
            uri: '/bodies/' + body.id,
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
            uri: '/bodies/' + body.id,
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 if no permissions on a deleted body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            uri: '/bodies/' + body.id,
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
        const token = await generator.createAccessToken({}, user);

        await generator.createPermission({ scope: 'global', action: 'view_deleted', object: 'body' });

        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            uri: '/bodies/' + body.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(body.id);
    });
});
