const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Payment } = require('../../models');

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

        const payment = generator.generatePayment({}, {}, { user_id: 2147483647 });

        const res = await request({
            path: '/bodies/' + body.id + '/payments',
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
            path: '/bodies/' + body.id + '/payments',
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
            path: '/bodies/' + body.id + '/payments',
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
            path: '/bodies/' + body.id + '/payments',
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
            path: '/bodies/' + body.id + '/payments',
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
        await generator.createBodyMembership(body, otherUser, { body_id: 2147483647 });

        const payment = generator.generatePayment(body, otherUser);

        const res = await request({
            path: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).not.toEqual(2147483647);
    });

    test('should ignore fields that are not allowed', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

        const body = await generator.createBody();
        const otherUser = await generator.createUser();
        await generator.createBodyMembership(body, otherUser);

        const payment = generator.generatePayment(body, otherUser, { id: 2147483647, comment: 'Some comment' });

        const res = await request({
            path: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: payment
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).not.toEqual(2147483647);

        const paymentFromDb = await Payment.findByPk(res.body.data.id);
        expect(paymentFromDb.comment).toEqual('Some comment');
        expect(paymentFromDb.body_id).toEqual(body.id);
        expect(paymentFromDb.user_id).toEqual(otherUser.id);
    });

    test.each([
        ['missing', undefined],
        ['a text that is not a number', 'abc'],
        ['an empty text', ''],
        ['a list', [1]],
        ['an object', { id: 1 }],
        ['a fraction', 1.5],
        ['a boolean', true],
        ['null', null]
    ])('should return 400 if the user id is %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });
        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id + '/payments',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { ...generator.generatePayment(), user_id: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The user ID is not valid.' });
        expect(await Payment.count()).toEqual(0);
    });

    describe('with a date, an amount or a currency that is not one', () => {
        const valid = { starts: '2026-03-01', expires: '2027-03-01', amount: 30, currency: 'EUR' };

        test.each([
            ['an end before the start', { expires: '2026-02-28' }, { expires: ['Expiration date should be after the start date.'] }],
            ['an end on the day of the start', { expires: '2026-03-01' }, { expires: ['Expiration date should be after the start date.'] }],
            ['an end that is not a date', { expires: 'abc' }, { expires: ['Expiration date should be valid.'] }],
            ['a start that is not a date', { starts: 'abc' }, { starts: ['Starts date should be valid.'] }],
            ['no start', { starts: undefined }, { starts: ['Starts date should be set.', 'Starts date should be valid.'] }],
            ['an amount that is not a number', { amount: 'abc' }, { amount: ['Amount should be valid.'] }],
            ['an amount with a comma', { amount: '12,50' }, { amount: ['Amount should be valid.'] }],
            ['an amount below zero', { amount: -1 }, { amount: ['Amount cannot be negative.'] }],
            ['no amount', { amount: undefined }, { amount: ['Amount should be set.', 'Amount should be valid.'] }],
            ['an empty currency', { currency: '   ' }, { currency: ['Currency should be set.'] }]
        ])('should fail for %s, and store no payment', async (name, fields, errors) => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

            const body = await generator.createBody();
            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const res = await request({
                path: '/bodies/' + body.id + '/payments',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { ...valid, ...fields, user_id: member.id }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors });
            expect(await Payment.count()).toEqual(0);
        });

        test('should store an amount with cents', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'create', object: 'payment' });

            const body = await generator.createBody();
            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const res = await request({
                path: '/bodies/' + body.id + '/payments',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { ...valid, amount: '12.50', user_id: member.id }
            });

            expect(res.statusCode).toEqual(200);

            const paymentFromDb = await Payment.findByPk(res.body.data.id);
            expect(Number(paymentFromDb.amount)).toEqual(12.5);
            expect(paymentFromDb.starts).toEqual('2026-03-01');
            expect(paymentFromDb.expires).toEqual('2027-03-01');
        });
    });
});
