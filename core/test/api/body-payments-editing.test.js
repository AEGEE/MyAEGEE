const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body payments editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the payment is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'payment' });

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { amount: 1 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the payment ID is invalid', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'payment' });

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/lalala',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { amount: 1 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { amount: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with global permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { amount: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.amount).toEqual(1);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { amount: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.amount).toEqual(1);
    });

    test('should fail on validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { amount: -1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('amount');
    });

    test('should not override body_id and user_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { body_id: 1337, user_id: 1337 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).not.toEqual(1337);
        expect(res.body.data.user_id).not.toEqual(1337);
    });
});
