const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

// A body as core returns it: more than the three fields the route passes on.
const coreBody = (id, name, type) => ({
    id,
    name,
    type,
    code: 'XYZ',
    email: `body-${id}@example.org`,
    phone: '+1234567890',
    address: 'Example street 1',
    description: 'A body for the tests.'
});

const bodies = [
    coreBody(34, 'AEGEE-Alicante', 'antenna'),
    coreBody(35, 'AEGEE-Bergamo', 'antenna'),
    coreBody(36, 'AEGEE-Cagliari', 'contact antenna'),
    coreBody(37, 'AEGEE-Dresden', 'contact'),
    coreBody(38, 'AEGEE-Eindhoven', 'antenna')
];

const SEE_WITHOUT_FEE = 'global:see_memberslists_without_fee:agora';

const membersWithFees = (...fees) => fees.map((fee) => generator.generateMembersListMember({ fee }));

describe('Memberslists without fee', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { permissions: [SEE_WITHOUT_FEE] }, bodies: { data: bodies } });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const getWithoutFee = (event) => request({
        path: '/events/' + event.id + '/memberslists/without_fee',
        method: 'GET',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    test('refuses a member without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, bodies: { data: bodies } });
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 34, members: membersWithFees(0) }, event);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'You are not allowed to see memberslists without fee.' });
    });

    test('refuses the board of a local, the other members lists permissions and the permission for another event type', async () => {
        // The default mocks make the caller a board member of their first body.
        mock.mockAll({
            mainPermissions: {
                permissions: [
                    'global:see_memberslists_without_fee:epm',
                    'global:see_missing_memberslists:agora',
                    'global:see_memberslists:agora',
                    'global:manage_memberslist:agora',
                    'global:set_memberslists_fee_paid:agora'
                ]
            },
            bodies: { data: bodies }
        });
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 34, members: membersWithFees(0) }, event);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'You are not allowed to see memberslists without fee.' });
    });

    test('lists the bodies whose members list for this Agora has a fee of 0 for every member, with their id, name and type only', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        const otherEvent = await generator.createEvent({ type: 'agora' });

        await generator.createMembersList({ body_id: 34, members: membersWithFees(0, 0, 0) }, event);
        // One member who pays is enough to leave the body out.
        await generator.createMembersList({ body_id: 35, members: membersWithFees(0, 0.01, 0) }, event);
        await generator.createMembersList({ body_id: 36, members: membersWithFees(0) }, event);
        await generator.createMembersList({ body_id: 37, members: membersWithFees(25, 30) }, event);
        // A members list without fees for another Agora does not count, and 38 has none for this one.
        await generator.createMembersList({ body_id: 38, members: membersWithFees(0) }, otherEvent);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({
            success: true,
            data: [
                { id: 34, name: 'AEGEE-Alicante', type: 'antenna' },
                { id: 36, name: 'AEGEE-Cagliari', type: 'contact antenna' }
            ]
        });
    });

    test('lists nothing when every members list has a fee', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 34, members: membersWithFees(10) }, event);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    test('leaves out a body that core does not list', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337, members: membersWithFees(0) }, event);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    // BUG: the upload accepts a fee sent as a string ("0") and stores it as it came, and this route
    // compares every fee with the number 0. Expected: the body is listed, or the upload stores a number.
    test('leaves out a members list whose fees of 0 were sent as strings', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 34, members: membersWithFees('0', '0') }, event);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    test.each(['epm', 'spm'])('answers 400 for an %s event', async (type) => {
        mock.mockAll({
            mainPermissions: { permissions: [SEE_WITHOUT_FEE, `global:see_memberslists_without_fee:${type}`] },
            bodies: { data: bodies }
        });
        const event = await generator.createEvent({ type });

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
    });

    test.each([
        ['is not reachable', { netError: true }],
        ['answers with garbage', { badResponse: true }],
        ['refuses the request', { unsuccessfulResponse: true }]
    ])('answers 500 when core %s for the bodies', async (description, bodiesMock) => {
        mock.mockAll({ mainPermissions: { permissions: [SEE_WITHOUT_FEE] }, bodies: bodiesMock });
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 34, members: membersWithFees(0) }, event);

        const res = await getWithoutFee(event);

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });
});
