const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Circle memberships creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 400 if the user_id is invalid', async () => {
        const currentUser = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, currentUser);

        const circle = await generator.createCircle();

        const res = await request({
            uri: '/circles/' + circle.id + '/members/lalala',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the user is not found', async () => {
        const currentUser = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, currentUser);

        const circle = await generator.createCircle();

        const res = await request({
            uri: '/circles/' + circle.id + '/members/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the user is not a member of a body', async () => {
        const currentUser = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, currentUser);

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser();

        const res = await request({
            uri: '/circles/' + circle.id + '/members/' + user.id,
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay for a bound circle', async () => {
        const currentUser = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, currentUser);

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser();
        await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/circles/' + circle.id + '/members/' + user.id,
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should succeed if everything is okay for a free circle', async () => {
        const currentUser = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, currentUser);

        const circle = await generator.createCircle();
        const user = await generator.createUser();

        const res = await request({
            uri: '/circles/' + circle.id + '/members/' + user.id,
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });
});
