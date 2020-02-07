const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('User editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the user is not found', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/members/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'username with spaces' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.username).toEqual('test2');
    });

    test('should discard fields edited in other endpoints', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errrors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.email).not.toEqual('test@test.io');
    });
});
