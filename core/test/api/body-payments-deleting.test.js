const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Payment } = require('../../models');

describe('Body payments deleting', () => {
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

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'payment' });

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
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
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with global permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const paymentFromDb = await Payment.findByPk(payment.id);
        expect(paymentFromDb).toEqual(null);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'delete', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const payment = await generator.createPayment(body, otherUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/payments/' + payment.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const paymentFromDb = await Payment.findByPk(payment.id);
        expect(paymentFromDb).toEqual(null);
    });
});
