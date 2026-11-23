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

    describe('validation', () => {
        let valid;

        beforeEach(async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();

            valid = {
                user_id: user.id,
                body_id: body.id,
                amount: 1,
                currency: 'EUR',
                starts: '2026-03-01',
                expires: '2027-03-01'
            };
        });

        test.each([
            ['an amount that is not a decimal', { amount: 'abc' }, 'amount', ['Amount should be valid.']],
            ['an amount with a comma', { amount: '1,5' }, 'amount', ['Amount should be valid.']],
            ['a negative amount', { amount: -0.01 }, 'amount', ['Amount cannot be negative.']],
            ['not set amount', { amount: undefined }, 'amount', ['Amount should be set.', 'Amount should be valid.']],
            ['null amount', { amount: null }, 'amount', ['payment.amount cannot be null']],
            ['not set starts', { starts: undefined }, 'starts', ['Starts date should be set.', 'Starts date should be valid.']],
            ['null starts', { starts: null }, 'starts', ['payment.starts cannot be null']],
            ['starts that is not a date', { starts: 'abc' }, 'starts', ['Starts date should be valid.']],
            ['not set expires', { expires: undefined }, 'expires', ['Expiration date should be set.', 'Expiration date should be valid.']],
            ['expires that is not a date', { expires: 'abc' }, 'expires', ['Expiration date should be valid.']],
            ['expires on the day of starts', { expires: '2026-03-01' }, 'expires', ['Expiration date should be after the start date.']],
            ['empty currency', { currency: '' }, 'currency', ['Currency should be set.']],
            ['currency of spaces', { currency: '  \t ' }, 'currency', ['Currency should be set.']],
            ['not set currency', { currency: undefined }, 'currency', ['payment.currency cannot be null']]
        ])('should fail with %s', async (name, fields, path, messages) => {
            await expect(Payment.create({ ...valid, ...fields })).rejects.toMatchObject({
                name: 'SequelizeValidationError',
                errors: messages.map((message) => expect.objectContaining({ path, message }))
            });
            expect(await Payment.count()).toEqual(0);
        });

        test.each([
            ['zero', 0],
            ['an amount with cents', 12.5],
            ['an amount with cents as a text', '12.50']
        ])('should succeed with %s as the amount', async (name, amount) => {
            const payment = await Payment.create({ ...valid, amount });

            expect(Number((await Payment.findByPk(payment.id)).amount)).toEqual(Number(amount));
        });

        test('should succeed when the expiration date is the day after the start date', async () => {
            const payment = await Payment.create({ ...valid, expires: '2026-03-02' });

            expect(payment.expires).toEqual('2026-03-02');
        });
    });
});
