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

    test('should ignore id, image, status, deleted and published from the body', async () => {
        const event = await generator.createEvent({ image: 'original.png' });

        const res = await editEvent(event, { id: 1337, image: 'hacked.png', status: 'first draft', deleted: true, published: 'none', name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.id).not.toEqual(1337);
        expect(event.image).toEqual('original.png');
        expect(event.status).toEqual('second approval');
        expect(event.deleted).toEqual(false);
        expect(event.published).toEqual('full');
        expect(event.name).toEqual('Changed');
    });

    test('should ignore the application period, open call and participant counters from the body', async () => {
        const event = await generator.createEvent({ max_participants: 20, accepted_participants: 5 });
        const applicationStarts = event.application_starts.toISOString();
        const applicationEnds = event.application_ends.toISOString();

        const res = await editEvent(event, {
            application_starts: generator.daysFromNow(5),
            application_ends: generator.daysFromNow(10),
            open_call: true,
            accepted_participants: 0,
            available_spots: 100,
            name: 'Changed'
        });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.application_starts.toISOString()).toEqual(applicationStarts);
        expect(event.application_ends.toISOString()).toEqual(applicationEnds);
        expect(event.open_call).toEqual(false);
        expect(event.accepted_participants).toEqual(5);
        expect(event.available_spots).toEqual(15);
        expect(event.name).toEqual('Changed');
    });

    test('should allow changing max_participants', async () => {
        const event = await generator.createEvent({ max_participants: 20 });

        const res = await editEvent(event, { max_participants: 30 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.max_participants).toEqual(30);
        await event.reload();
        expect(event.max_participants).toEqual(30);
    });

    test('should close the open call in the database if no spots are left', async () => {
        const event = await generator.createEvent({ max_participants: 20, accepted_participants: 10, open_call: true });

        const res = await editEvent(event, { max_participants: 10 });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.available_spots).toEqual(0);
        expect(event.open_call).toEqual(false);
    });

    test('should keep the open call if the edit is rolled back', async () => {
        mockAndCapture({ mailer: { netError: true } });
        const event = await generator.createEvent({ max_participants: 20, accepted_participants: 10, open_call: true });

        const res = await editEvent(event, { max_participants: 10 });

        expect(res.statusCode).toEqual(500);
        await event.reload();
        expect(event.max_participants).toEqual(20);
        expect(event.open_call).toEqual(true);
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

    // BUG: editEvent defaults a missing season to 2026, so any edit that does not resend
    // the season silently moves an older event to the 2026 season.
    test('should currently reset the season to 2026 if it is not in the body', async () => {
        const event = await generator.createEvent({ season: 2025 });

        const res = await editEvent(event, { name: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.season).toEqual(2026);
    });

    test('should keep the organizers and notify them if the organizers are not in the body', async () => {
        const event = await generator.createEvent();
        const organizers = event.organizers;

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { name: 'Changed' } });

        expect(res.statusCode).toEqual(200);
        await event.reload();
        expect(event.name).toEqual('Changed');
        expect(event.organizers).toEqual(organizers);
        expect(mails.map((mail) => mail.template)).toEqual(['summeruniversity_event_updated.html']);
        expect(mails[0].to).toEqual(Array(4).fill(user.notification_email));
    });

    // Because season is always defaulted, the 'No valid field changes requested' branch is unreachable.
    test('should currently accept an empty body', async () => {
        const event = await generator.createEvent();

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: {} });

        expect(res.statusCode).toEqual(200);
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

        test('should use the stored status if the status is not in the body', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first draft', published: 'none' });

            const res = await editEvent(event, { name: 'Submitted' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('first submission');
            expect(mails.length).toEqual(2);
        });

        test('should ignore a status in the body that differs from the stored one', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await editEvent(event, { status: 'first draft', name: 'Changed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('first submission');
            expect(mails.map((mail) => mail.template)).toEqual(['summeruniversity_event_updated.html']);
        });

        test.each([
            ['first draft', 'none'],
            ['first approval', 'minimal']
        ])('should return 403 for a manager who cannot submit a %s', async (status, published) => {
            // A manager who is neither an organizer nor an approver can edit, but not submit.
            mockAndCapture({ mainPermissions: { data: mock.permissionsList(['global:manage_summeruniversity:regular']) } });
            const event = await generator.createEvent({ status, published, organizers: generator.generateOrganizers(9999) });

            const res = await editEvent(event, { name: 'Changed' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change status.');
            await event.reload();
            expect(event.status).toEqual(status);
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
