const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { MembersList } = require('../../models');
const regularUser = require('../assets/core-valid.json').data;

describe('Memberslist fee_paid editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if user has no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('You are not allowed to set the paid fee of this memberslist.');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has permissions', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.fee_paid).toEqual(300);
    });

    test('should normalize sub-cent unpaid difference to zero', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            currency: 'EU',
            members: [generator.generateMembersListMember({ fee: 16 })]
        }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 1.996 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.fee_not_paid).toEqual(0);
    });

    test('should normalize sub-cent overpayment difference to zero', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            currency: 'EU',
            members: [generator.generateMembersListMember({ fee: 16 })]
        }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 2.004 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.fee_not_paid).toEqual(0);
    });

    test('should return 404 if the memberslist is not found', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if body_id is NaN', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/false/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('who may set it and what it accepts', () => {
        const bodyId = regularUser.bodies[0].id;
        let event;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:set_memberslists_fee_paid:agora'] } });

            event = await generator.createEvent({ type: 'agora' });
            await generator.createMembersList({ body_id: bodyId, fee_paid: 12 }, event);
        });

        const setFeePaid = (body, targetEvent = event) => request({
            path: '/events/' + targetEvent.id + '/memberslists/' + bodyId + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        const storedFeePaid = async () => {
            const memberslist = await MembersList.findOne({ where: { event_id: event.id, body_id: bodyId } });
            return Number(memberslist.fee_paid);
        };

        test('lets a holder of global:set_memberslists_fee_paid:agora alone set it', async () => {
            const res = await setFeePaid({ fee_paid: 300 });

            expect(res.statusCode).toEqual(200);
            expect(Number(res.body.data.fee_paid)).toEqual(300);
            expect(await storedFeePaid()).toEqual(300);
        });

        test('refuses the board of the local, the other members lists permissions and the permission for another event type', async () => {
            // The default mocks make the caller a board member of this body.
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:set_memberslists_fee_paid:epm',
                        'global:manage_memberslist:agora',
                        'global:see_memberslists:agora',
                        'global:edit_memberslist_between_deadlines:agora'
                    ]
                }
            });

            const res = await setFeePaid({ fee_paid: 300 });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You are not allowed to set the paid fee of this memberslist.' });
            expect(await storedFeePaid()).toEqual(12);
        });

        test.each([
            ['a zero', 0, 0],
            ['a number with cents', 12.34, 12.34],
            ['a number as a string', '12.5', 12.5]
        ])('accepts %s', async (description, value, expected) => {
            const res = await setFeePaid({ fee_paid: value });

            expect(res.statusCode).toEqual(200);
            expect(Number(res.body.data.fee_paid)).toEqual(expected);
            expect(await storedFeePaid()).toEqual(expected);
        });

        test.each([
            ['a word', 'abc', 'Fee paid should be a number.'],
            ['an empty string', '', 'Fee paid should be a number.'],
            ['a boolean', true, 'Fee paid should be a number.'],
            ['a negative number', -1, 'Fee paid should be positive.'],
            ['a negative number as a string', '-0.01', 'Fee paid should be positive.']
        ])('answers 422 for %s and stores nothing', async (description, value, message) => {
            const res = await setFeePaid({ fee_paid: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { fee_paid: [message] } });
            expect(await storedFeePaid()).toEqual(12);
        });

        test('answers 422 for null and stores nothing', async () => {
            const res = await setFeePaid({ fee_paid: null });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { fee_paid: ['Fee paid should be set.'] } });
            expect(await storedFeePaid()).toEqual(12);
        });

        test('changes nothing without fee_paid in the body', async () => {
            const res = await setFeePaid({});

            expect(res.statusCode).toEqual(200);
            expect(Number(res.body.data.fee_paid)).toEqual(12);
            expect(await storedFeePaid()).toEqual(12);
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event', async (type) => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:set_memberslists_fee_paid:agora', `global:set_memberslists_fee_paid:${type}`] }
            });
            const otherEvent = await generator.createEvent({ type });
            await generator.createMembersList({ body_id: bodyId, fee_paid: 12 }, otherEvent);

            const res = await setFeePaid({ fee_paid: 300 }, otherEvent);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });

            const memberslist = await MembersList.findOne({ where: { event_id: otherEvent.id, body_id: bodyId } });
            expect(Number(memberslist.fee_paid)).toEqual(12);
        });
    });

    test('should ask core for the user and the event permissions once', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

        const requests = [];
        const stubs = mock.mockAll();
        for (const stub of Object.values(stubs)) {
            stub.on('request', (req) => requests.push(`${req.method} ${req.path}`));
        }

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(200);
        // The user, their permissions, and the bodies they approve members and manage memberslists for.
        expect(requests.sort()).toEqual([
            'GET /members/me',
            'GET /my_permissions',
            'POST /my_permissions',
            'POST /my_permissions'
        ]);
    });

    test.each([
        ['null', null],
        ['a list', [1]],
        ['an object', { amount: 1 }],
        ['true', true]
    ])('should return 422 if the paid fee is %s', async (description, value) => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id, fee_paid: 12 }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: value }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('fee_paid');

        const memberslistFromDb = await MembersList.findOne({ where: { event_id: event.id } });
        expect(Number(memberslistFromDb.fee_paid)).toEqual(12);
    });
});
