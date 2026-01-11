const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

describe('Join request creating', () => {
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

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.motivation).toEqual('test');
    });

    test('should fail if join request is presented already', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        await generator.createJoinRequest(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if mailer fails', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should not send anything if no permission', async () => {
        const requestMock = mock.mockAll();

        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(false);
    });

    test('should not send anything if no circles', async () => {
        const requestMock = mock.mockAll();

        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const otherUser = await generator.createUser();
        await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(false);
    });

    test('should not send anything if no members', async () => {
        const requestMock = mock.mockAll();

        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(false);
    });

    test('should send mails if there are members', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const requestMock = mock.mockAll({
            mailer: {
                body: (b) => b.to.length === 1 && b.to[0] === otherUser.email.toLowerCase()
            }
        });

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(true);
    });
});
