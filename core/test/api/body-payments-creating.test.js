const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Body payments creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if no user', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

        const payment = generator.generatePayment({}, {}, { user_id: 1337 });

        const res = await request({
            uri: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if user is not a member of a body', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser();

        await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

        const payment = generator.generatePayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(403);
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

        const payment = generator.generatePayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with global permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = generator.generatePayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.amount).toEqual(payment.amount);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'create', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const payment = generator.generatePayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.amount).toEqual(payment.amount);
    });

    test('should not override body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser, { body_id: 1337 });

        const payment = generator.generatePayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).not.toEqual(1337);
    });
});
