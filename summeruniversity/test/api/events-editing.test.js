const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

// The organizer (user #1) without any global permissions.
const organizerMocks = { mainPermissions: { noPermissions: true } };

describe('Events editing', () => {
    let mails;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mails = mock.captureMails(mock.mockAll().omsMailerStub);
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const mockAndCapture = (options) => {
        mails = mock.captureMails(mock.mockAll(options).omsMailerStub);
    };

    const editEvent = (event, body) => request({
        path: '/single/' + event.id,
        method: 'PUT',
        headers: { 'X-Auth-Token': 'foobar' },
        body: { organizers: event.organizers, ...body }
    });

    test('should return 401 if the user is not authenticated', async () => {
        mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } });
        const event = await generator.createEvent();

        const res = await editEvent(event, { name: 'Changed' });

        expect(res.statusCode).toEqual(401);
    });

    test('should return 404 if the event does not exist', async () => {
        const res = await request({ path: '/single/1337', method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { name: 'Changed' } });

        expect(res.statusCode).toEqual(404);
    });

    test('should return 403 for a user who is neither an organizer nor a manager', async () => {
        mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ status: 'first draft', published: 'none' });

        const res = await editEvent(event, { name: 'Changed' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You cannot edit this event');
        await event.reload();
        expect(event.name).not.toEqual('Changed');
    });

    test('should return 403 for an organizer if the event is in second approval', async () => {
        mockAndCapture(organizerMocks);
        const event = await generator.createEvent({ status: 'second approval' });

        const res = await editEvent(event, { name: 'Changed' });

        expect(res.statusCode).toEqual(403);
    });

    test('should allow a manager to edit an event in second approval and notify the organizers', async () => {
        const event = await generator.createEvent({ status: 'second approval', organizers: generator.generateOrganizers(9999) });

        const res = await editEvent(event, { name: 'Changed by manager' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual('Changed by manager');
        expect(res.body.data.status).toEqual('second approval');

        await event.reload();
        expect(event.name).toEqual('Changed by manager');

        expect(mails.map((mail) => mail.template)).toEqual(['summeruniversity_event_updated.html']);
        expect(mails[0].to).toEqual(Array(4).fill(user.notification_email));
    });

    test('should allow an organizer to edit an event in first approval', async () => {
        mockAndCapture(organizerMocks);
        const event = await generator.createEvent({ status: 'first approval', published: 'minimal' });

        const res = await editEvent(event, { description: 'New description' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.description).toEqual('New description');
    });

    test('should ignore id, image, deleted and published from the body', async () => {
        const event = await generator.createEvent({ image: 'original.png' });

        const res = await editEvent(event, { id: 1337, image: 'hacked.png', deleted: true, published: 'none', name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.id).not.toEqual(1337);
        expect(event.image).toEqual('original.png');
        expect(event.deleted).toEqual(false);
        expect(event.published).toEqual('full');
        expect(event.name).toEqual('Changed');
    });

    test('should refetch the organizing and cooperation bodies from core', async () => {
        const event = await generator.createEvent();

        const res = await editEvent(event, {
            organizing_bodies: [{ body_id: 34, body_name: 'whatever' }],
            cooperation: [{ body_id: 34 }]
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.organizing_bodies).toEqual([{ body_id: 34, body_name: 'AEGEE-Alicante' }]);
        expect(res.body.data.cooperation).toEqual([{ body_id: 34, body_name: 'AEGEE-Alicante' }]);
    });

    test('should return 422 on validation errors and not change the event', async () => {
        const event = await generator.createEvent();

        const res = await editEvent(event, { email: 'not-an-email', name: 'Changed' });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('email');
        await event.reload();
        expect(event.name).not.toEqual('Changed');
        expect(mails.length).toEqual(0);
    });

    test('should keep the given season', async () => {
        const event = await generator.createEvent({ season: 2025 });

        const res = await editEvent(event, { season: 2025, name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.season).toEqual(2025);
    });

    test('should keep the season if it is not in the body', async () => {
        const event = await generator.createEvent({ season: 2025 });

        const res = await editEvent(event, { name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.season).toEqual(2025);
    });

    test('should let managers change the season', async () => {
        const event = await generator.createEvent({ season: 2025 });

        const res = await editEvent(event, { season: 2026 });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.season).toEqual(2026);
    });

    test('should not let organizers change the season', async () => {
        mockAndCapture(organizerMocks);
        const event = await generator.createEvent({ season: 2025, status: 'second submission' });

        const res = await editEvent(event, { season: 2026, name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.name).toEqual('Changed');
        expect(event.season).toEqual(2025);
    });

    test('should not let managers of only the other type change the season', async () => {
        mockAndCapture({ mainPermissions: { permissions: ['global:manage_summeruniversity:pilot'] } });
        const event = await generator.createEvent({ season: 2025, type: 'regular', status: 'second submission' });

        const res = await editEvent(event, { season: 2026, name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.season).toEqual(2025);
    });

    // BUG: editEvent always calls data.organizers.map(), so a body without organizers
    // crashes with a 500 (the update is rolled back by the transaction).
    test('should currently return 500 if the organizers are not in the body', async () => {
        const event = await generator.createEvent();

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { name: 'Changed' } });

        expect(res.statusCode).toEqual(500);
        await event.reload();
        expect(event.name).not.toEqual('Changed');
    });

    test('should return 422 on an empty body', async () => {
        const event = await generator.createEvent();

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: {} });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('No valid field changes requested');
    });

    describe('status transitions when saving', () => {
        test('should move a first draft to first submission and notify SUCT', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first draft', published: 'none' });

            const res = await editEvent(event, { status: 'first draft', name: 'Submitted' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('first submission');
            await event.reload();
            expect(event.status).toEqual('first submission');
            expect(mails.map((mail) => mail.template)).toEqual([
                'summeruniversity_event_updated.html',
                'summeruniversity_submitted.html'
            ]);
            expect(mails[1].to).toEqual(['suct@aegee.eu']);
        });

        test('should move a first approval to second submission', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first approval', published: 'minimal' });

            const res = await editEvent(event, { status: 'first approval' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('second submission');
            expect(mails.length).toEqual(2);
        });

        test('should move a second draft to second submission', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'second draft', published: 'minimal' });

            const res = await editEvent(event, { status: 'second draft' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('second submission');
        });

        test('should not change the status for other statuses', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await editEvent(event, { status: 'first submission', name: 'Changed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('first submission');
            expect(mails.length).toEqual(1);
        });

        test('should return 403 if the claimed status does not match an allowed transition', async () => {
            mockAndCapture(organizerMocks);
            // The event is actually in first submission, so first draft -> first submission is not allowed.
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await editEvent(event, { status: 'first draft', name: 'Changed' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change status.');
        });

        test('should return 403 if the claimed first approval does not match the actual status', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await editEvent(event, { status: 'first approval' });

            expect(res.statusCode).toEqual(403);
        });
    });

    test('should return 500 and roll back if the mailer fails', async () => {
        mockAndCapture({ mailer: { netError: true } });
        const event = await generator.createEvent();

        const res = await editEvent(event, { name: 'Changed' });

        expect(res.statusCode).toEqual(500);
        await event.reload();
        expect(event.name).not.toEqual('Changed');
    });

    test('should return 500 if fetching a body fails', async () => {
        mockAndCapture({ body: { netError: true } });
        const event = await generator.createEvent();

        const res = await editEvent(event, { organizing_bodies: [{ body_id: 34 }] });

        expect(res.statusCode).toEqual(500);
    });
});
