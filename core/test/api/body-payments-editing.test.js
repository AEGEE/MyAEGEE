const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Payment } = require('../../models');

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
            path: '/bodies/' + body.id + '/payments/2147483647',
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
            path: '/bodies/' + body.id + '/payments/lalala',
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
            path: '/bodies/' + body.id + '/payments/' + payment.id,
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
            path: '/bodies/' + body.id + '/payments/' + payment.id,
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
            path: '/bodies/' + body.id + '/payments/' + payment.id,
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
            path: '/bodies/' + body.id + '/payments/' + payment.id,
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
            path: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { body_id: 2147483647, user_id: 2147483647 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).not.toEqual(2147483647);
        expect(res.body.data.user_id).not.toEqual(2147483647);
    });

    test.each([
        ['an end before the start that is stored', { expires: '2026-02-28' }, { expires: ['Expiration date should be after the start date.'] }],
        ['a start after the end that is stored', { starts: '2027-03-02' }, { expires: ['Expiration date should be after the start date.'] }],
        ['a start that is not a date', { starts: 'abc' }, { starts: ['Starts date should be valid.'] }],
        ['an amount that is not a number', { amount: 'abc' }, { amount: ['Amount should be valid.'] }],
        ['an empty currency', { currency: '' }, { currency: ['Currency should be set.'] }]
    ])('should fail for %s, and keep the payment as it was', async (name, fields, errors) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = await generator.createPayment(body, otherUser, {
            starts: '2026-03-01',
            expires: '2027-03-01',
            amount: 30,
            currency: 'EUR'
        });

        const res = await request({
            path: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: fields
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toEqual({ success: false, errors });

        const paymentFromDb = await Payment.findByPk(payment.id);
        expect(paymentFromDb.starts).toEqual('2026-03-01');
        expect(paymentFromDb.expires).toEqual('2027-03-01');
        expect(Number(paymentFromDb.amount)).toEqual(30);
        expect(paymentFromDb.currency).toEqual('EUR');
    });
});
