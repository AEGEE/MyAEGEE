const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Memberslist listing', () => {
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
            path: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has permission', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: 1337 }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].body_id).toEqual(1337);
    });

    test('should succeed if user has read-only memberslists permission', async () => {
        mock.mockAll({
            mainPermissions: { seeMemberslistsPermissions: true },
            approvePermissions: { noPermissions: true },
            memberslistPermissions: { noPermissions: true }
        });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: 1337 }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].body_id).toEqual(1337);
    });

    test.each([
        'global:manage_memberslist:agora',
        'global:see_memberslists:agora'
    ])('lets a holder of %s alone list the members lists of this Agora only', async (permission) => {
        mock.mockAll({
            mainPermissions: { permissions: [permission] },
            approvePermissions: { noPermissions: true },
            memberslistPermissions: { noPermissions: true }
        });

        const event = await generator.createEvent({ type: 'agora' });
        const otherEvent = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337 }, event);
        await generator.createMembersList({ body_id: 1338 }, event);
        await generator.createMembersList({ body_id: 1339 }, otherEvent);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((memberslist) => memberslist.body_id).sort()).toEqual([1337, 1338]);
    });

    test('refuses the board of a local, the other members lists permissions and the permissions for another event type', async () => {
        // The default mocks make the caller a board member of their first body.
        mock.mockAll({
            mainPermissions: {
                permissions: [
                    'global:manage_memberslist:epm',
                    'global:see_memberslists:epm',
                    'global:see_missing_memberslists:agora',
                    'global:see_memberslists_without_fee:agora',
                    'global:set_memberslists_fee_paid:agora',
                    'global:edit_memberslist_between_deadlines:agora'
                ]
            }
        });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'You are not allowed to see memberslists.' });
    });

    test('should fail if the event is not Agora', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'epm',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });
});
