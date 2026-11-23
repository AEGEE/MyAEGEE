const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Memberslist displaying', () => {
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

    test('should fail if user has no permissions at all', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if user has local permission for random body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has local permission for his body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should succeed if user has global permission for random body', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should fail to view memberslist if user has only approve_members but not manage_memberslist', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed to view memberslist if user has manage_memberslist but not approve_members', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test.each([
        'global:manage_memberslist:agora',
        'global:see_memberslists:agora'
    ])('lets a holder of %s alone see the members list of any body', async (permission) => {
        mock.mockAll({
            mainPermissions: { permissions: [permission] },
            approvePermissions: { noPermissions: true },
            memberslistPermissions: { noPermissions: true }
        });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toEqual(1337);
        expect(res.body.data.event_id).toEqual(event.id);
    });

    test('refuses the members list of another body to the board of a local with the permissions for another event type', async () => {
        // The default mocks make the caller a board member of their first body, not of body 1337.
        mock.mockAll({
            mainPermissions: {
                permissions: [
                    'global:manage_memberslist:epm',
                    'global:see_memberslists:epm',
                    'global:see_missing_memberslists:agora',
                    'global:see_memberslists_without_fee:agora',
                    'global:set_memberslists_fee_paid:agora'
                ]
            }
        });

        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'You are not allowed to see this memberslist.' });
    });

    test('shows the board of a local its members list of this Agora, not the one of another Agora', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora' });
        const otherEvent = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, otherEvent);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'Members list is not found.' });
    });

    // BUG: the body id is read with parseInt, so a value that only starts with digits is taken as that
    // number. Expected: 400, as for any other value that is not a number.
    test('takes a body id that starts with digits as that number', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337abc',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toEqual(1337);
    });

    test('should fail if the event is not Agora', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'epm' });
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if members list is not uploaded', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if body_id is invalid', async () => {
        const event = await generator.createEvent({ type: 'agora' });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/invalid',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
