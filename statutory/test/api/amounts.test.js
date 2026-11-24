const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Event, MembersList } = require('../../models');

const AMOUNT = 'The value should be an amount with at most 10 digits before the decimal point and 4 after it.';

// An amount (the fee of an event, the paid fee of a members list) has at most 10 digits
// before the decimal point and 4 after it (a paid fee can hold fractions of a cent). A longer
// one answers 422 and is not stored.
describe('Amounts', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({ type: 'agora', fee: 10, applications: [] });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (method, path, body) => request({
        path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const TOO_LONG = [
        ['11 digits', '1'.repeat(11)],
        ['3,000 digits', '1'.repeat(3000)],
        ['1e300', 1e300],
        ['12.34567', 12.34567],
        ['"12.34567"', '12.34567'],
        ['"0.00001"', '0.00001']
    ];

    test.each(TOO_LONG)('an event fee of %s answers 422', async (description, fee) => {
        const res = await send('PUT', '/events/' + event.id, { fee });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.fee).toContain(AMOUNT);
        expect(Number((await Event.findByPk(event.id)).fee)).toEqual(10);
    });

    test.each([0, 12.34, '12.5', 1.996, '9999999999.9999', 9999999999])('an event fee of %s is stored', async (fee) => {
        const res = await send('PUT', '/events/' + event.id, { fee });

        expect(res.statusCode).toEqual(200);
        expect(Number((await Event.findByPk(event.id)).fee)).toEqual(Number(fee));
    });

    test.each(TOO_LONG)('a paid fee of %s answers 422', async (description, feePaid) => {
        await generator.createMembersList({ body_id: regularUser.bodies[0].id, fee_paid: 5 }, event);

        const res = await send('PUT', '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid', { fee_paid: feePaid });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.fee_paid).toContain(AMOUNT);
        expect(Number((await MembersList.findOne()).fee_paid)).toEqual(5);
    });

    test('a paid fee of 12.34 is stored', async () => {
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

        const res = await send('PUT', '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid', { fee_paid: 12.34 });

        expect(res.statusCode).toEqual(200);
        expect(Number((await MembersList.findOne()).fee_paid)).toEqual(12.34);
    });
});
