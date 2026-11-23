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

// Every type of local, and two bodies that are not locals.
const bodies = [
    coreBody(34, 'AEGEE-Alicante', 'antenna'),
    coreBody(35, 'AEGEE-Bergamo', 'antenna'),
    coreBody(36, 'AEGEE-Cagliari', 'contact antenna'),
    coreBody(37, 'AEGEE-Dresden', 'contact'),
    coreBody(38, 'AEGEE-Eindhoven', 'antenna'),
    coreBody(9, 'Chair Team of the Agora', 'commission'),
    coreBody(10, 'Culture Interest Group', 'interest group')
];

const SEE_MISSING = 'global:see_missing_memberslists:agora';

describe('Memberslists missing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { permissions: [SEE_MISSING] }, bodies: { data: bodies } });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const getMissing = (event) => request({
        path: '/events/' + event.id + '/memberslists/missing',
        method: 'GET',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    test('refuses a member without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, bodies: { data: bodies } });
        const event = await generator.createEvent({ type: 'agora' });

        const res = await getMissing(event);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'You are not allowed to see missing memberslists.' });
    });

    test('refuses the board of a local, the other members lists permissions and the permission for another event type', async () => {
        // The default mocks make the caller a board member of their first body.
        mock.mockAll({
            mainPermissions: {
                permissions: [
                    'global:see_missing_memberslists:epm',
                    'global:see_memberslists_without_fee:agora',
                    'global:see_memberslists:agora',
                    'global:manage_memberslist:agora',
                    'global:set_memberslists_fee_paid:agora'
                ]
            },
            bodies: { data: bodies }
        });
        const event = await generator.createEvent({ type: 'agora' });

        const res = await getMissing(event);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'You are not allowed to see missing memberslists.' });
    });

    test('lists the locals without a members list for this Agora, with their id, name and type only', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        const otherEvent = await generator.createEvent({ type: 'agora' });

        await generator.createMembersList({ body_id: 34 }, event);
        // A members list for another Agora does not count.
        await generator.createMembersList({ body_id: 38 }, otherEvent);

        const res = await getMissing(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({
            success: true,
            data: [
                { id: 35, name: 'AEGEE-Bergamo', type: 'antenna' },
                { id: 36, name: 'AEGEE-Cagliari', type: 'contact antenna' },
                { id: 37, name: 'AEGEE-Dresden', type: 'contact' },
                { id: 38, name: 'AEGEE-Eindhoven', type: 'antenna' }
            ]
        });
    });

    test('lists nothing when every local has a members list', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        for (const bodyId of [34, 35, 36, 37, 38]) {
            await generator.createMembersList({ body_id: bodyId }, event);
        }

        const res = await getMissing(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    test.each(['epm', 'spm'])('answers 400 for an %s event', async (type) => {
        mock.mockAll({
            mainPermissions: { permissions: [SEE_MISSING, `global:see_missing_memberslists:${type}`] },
            bodies: { data: bodies }
        });
        const event = await generator.createEvent({ type });

        const res = await getMissing(event);

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
    });

    test.each([
        ['is not reachable', { netError: true }],
        ['answers with garbage', { badResponse: true }],
        ['refuses the request', { unsuccessfulResponse: true }]
    ])('answers 500 when core %s for the bodies', async (description, bodiesMock) => {
        mock.mockAll({ mainPermissions: { permissions: [SEE_MISSING] }, bodies: bodiesMock });
        const event = await generator.createEvent({ type: 'agora' });

        const res = await getMissing(event);

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });
});
