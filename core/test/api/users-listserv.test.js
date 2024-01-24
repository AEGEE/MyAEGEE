const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

describe('User subscribe listserv', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should return 404 if the user is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

        const res = await request({
            uri: '/members/1337/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { mailinglists: ['ANNOUNCE-L'] }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailinglists is not provided', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

        const res = await request({
            uri: '/members/' + user.id + '/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailinglists is not an array', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

        const res = await request({
            uri: '/members/' + user.id + '/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { mailinglists: 'not-valid' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailinglists is an empty array', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

        const res = await request({
            uri: '/members/' + user.id + '/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { mailinglists: [] }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailinglists includes invalid mailing lists', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

        const res = await request({
            uri: '/members/' + user.id + '/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { mailinglists: ['ANNOUNCE-L', 'BOARDINF-L'] }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.message).toEqual('Mailinglists must be one of the following: AEGEE-L, AEGEENEWS-L, ANNOUNCE-L, AEGEE-EVENT-L.');
    });

    // test('should fail if mailer fails', async () => {
    //     mock.mockAll({ mailer: { netError: true } });

    //     const user = await generator.createUser({ superadmin: true });
    //     const token = await generator.createAccessToken(user);

    //     await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

    //     const res = await request({
    //         uri: '/members/' + user.id + '/listserv',
    //         method: 'POST',
    //         headers: { 'X-Auth-Token': token.value },
    //         body: { mailinglists: ['ANNOUNCE-L'] }
    //     });

    //     expect(res.statusCode).toEqual(500);
    //     expect(res.body.success).toEqual(false);
    //     expect(res.body).not.toHaveProperty('data');
    //     expect(res.body).toHaveProperty('message');
    // });

    // test('should succeed for one mailinglist if everything is okay', async () => {
    //     const user = await generator.createUser({ superadmin: true });
    //     const token = await generator.createAccessToken(user);

    //     await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

    //     const res = await request({
    //         uri: '/members/' + user.id + '/listserv',
    //         method: 'POST',
    //         headers: { 'X-Auth-Token': token.value },
    //         body: { mailinglists: ['ANNOUNCE-L'] }
    //     });

    //     expect(res.statusCode).toEqual(200);
    //     expect(res.body.success).toEqual(true);
    //     expect(res.body).not.toHaveProperty('errors');
    //     expect(res.body).toHaveProperty('message');
    //     expect(res.body.message).toEqual('Request for subscribing to ANNOUNCE-L has been sent.');
    // });

    // test('should succeed for multiple mailinglists if everything is okay', async () => {
    //     const user = await generator.createUser({ superadmin: true });
    //     const token = await generator.createAccessToken(user);

    //     await generator.createPermission({ scope: 'global', action: 'subscribe', object: 'listserv' });

    //     const res = await request({
    //         uri: '/members/' + user.id + '/listserv',
    //         method: 'POST',
    //         headers: { 'X-Auth-Token': token.value },
    //         body: { mailinglists: ['announce-l, AEGEE-L, AeGeEnEwS-l'] }
    //     });

    //     expect(res.statusCode).toEqual(200);
    //     expect(res.body.success).toEqual(true);
    //     expect(res.body).not.toHaveProperty('errors');
    //     expect(res.body).toHaveProperty('message');
    //     expect(res.body.message).toEqual('Request for subscribing to ANNOUNCE-L, AEGEE-L, AEGEENEWS-L has been sent.');
    // });

    // test('should work for current user for /me without permission', async () => {
    //     const user = await generator.createUser();
    //     const token = await generator.createAccessToken(user);

    //     const res = await request({
    //         uri: '/members/' + user.id + '/listserv',
    //         method: 'POST',
    //         headers: { 'X-Auth-Token': token.value },
    //         body: { mailinglists: ['ANNOUNCE-L'] }
    //     });

    //     expect(res.statusCode).toEqual(200);
    //     expect(res.body.success).toEqual(true);
    //     expect(res.body).not.toHaveProperty('errors');
    //     expect(res.body).toHaveProperty('message');
    // });

    // test('should work for current user for /:user_id without permission', async () => {
    //     const user = await generator.createUser();
    //     const token = await generator.createAccessToken(user);

    //     const res = await request({
    //         uri: '/members/' + user.id + '/listserv',
    //         method: 'POST',
    //         headers: { 'X-Auth-Token': token.value },
    //         body: { mailinglists: ['ANNOUNCE-L'] }
    //     });

    //     expect(res.statusCode).toEqual(200);
    //     expect(res.body.success).toEqual(true);
    //     expect(res.body).not.toHaveProperty('errors');
    //     expect(res.body).toHaveProperty('message');
    // });

    test('should not work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'suscribe', object: 'listserv' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            uri: '/members/' + otherUser.id + '/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { mailinglists: ['ANNOUNCE-L'] }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            uri: '/members/' + otherUser.id + '/listserv',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { mailinglists: ['ANNOUNCE-L'] }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
