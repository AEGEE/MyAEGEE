const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { Payment } = require('../../models');

describe('Payments testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if the expiration date is earlier than the start date', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        try {
            await Payment.create({
                user_id: user.id,
                body_id: body.id,
                amount: 1,
                starts: moment().add(1, 'week').toDate(),
                expires: moment().subtract(1, 'week').toDate(),
                currency: '\t\t\ttest   \t\t \t',
                comment: '\t\t\ttest   \t\t \t',
                invoice_name: '\t\t\ttest   \t\t \t',
                invoice_address: '\t\t\ttest   \t\t \t'
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('expires');
        }
    });

    test('should fail if the currency is invalid', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        try {
            await Payment.create({
                user_id: user.id,
                body_id: body.id,
                amount: 1,
                currency: new Date(),
                starts: moment().subtract(1, 'week').toDate(),
                expires: moment().add(1, 'week').toDate(),
                comment: '\t\t\ttest   \t\t \t',
                invoice_name: '\t\t\ttest   \t\t \t',
                invoice_address: '\t\t\ttest   \t\t \t'
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('string violation');
            expect(err.errors[0].path).toEqual('currency');
        }
    });

    test('should normalize fields', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        const payment = await Payment.create({
            user_id: user.id,
            body_id: body.id,
            amount: 1,
            starts: moment().subtract(1, 'week').toDate(),
            expires: moment().add(1, 'week').toDate(),
            currency: '\t\t\ttest   \t\t \t',
            comment: '\t\t\ttest   \t\t \t',
            invoice_name: '\t\t\ttest   \t\t \t',
            invoice_address: '\t\t\ttest   \t\t \t'
        });
        expect(payment.currency).toEqual('test');
        expect(payment.comment).toEqual('test');
        expect(payment.invoice_name).toEqual('test');
        expect(payment.invoice_address).toEqual('test');
    });

    test('should not normalize fields that are not there', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        const payment = await Payment.create({
            user_id: user.id,
            body_id: body.id,
            starts: moment().subtract(1, 'week').toDate(),
            expires: moment().add(1, 'week').toDate(),
            amount: 1,
            currency: 'test',
            comment: null,
            invoice_name: null,
            invoice_address: null
        });

        expect(payment.comment).toEqual(null);
        expect(payment.invoice_name).toEqual(null);
        expect(payment.invoice_address).toEqual(null);
    });
});
