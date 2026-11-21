const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');

const unauthorizedMocks = {
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
};

// The organizer (user #1) without any global permissions.
const organizerMocks = { mainPermissions: { noPermissions: true } };

// User #5, not an organizer, without any permissions.
const strangerMocks = { core: { notSuperadmin: true }, mainPermissions: { noPermissions: true } };

// User #5, not an organizer, who can approve regular events.
const approverMocks = { core: { notSuperadmin: true }, mainPermissions: { permissions: ['global:approve_summeruniversity:regular'] } };

describe('Events status, publication, periods and deletion', () => {
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

    const put = (event, subpath, body) => request({
        path: '/single/' + event.id + subpath,
        method: 'PUT',
        headers: { 'X-Auth-Token': 'foobar' },
        body
    });

    describe('PUT /single/:id/status', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'first approval' });

            expect(res.statusCode).toEqual(401);
        });

        test('should return 404 if the event does not exist', async () => {
            const res = await request({ path: '/single/1337/status', method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { status: 'first approval' } });

            expect(res.statusCode).toEqual(404);
        });

        test('should return 403 for a user who cannot change the status', async () => {
            mockAndCapture(strangerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'first approval' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change status.');
            await event.reload();
            expect(event.status).toEqual('first submission');
            expect(mails.length).toEqual(0);
        });

        test('should not allow an organizer to approve their own event', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'first approval' });

            expect(res.statusCode).toEqual(403);
        });

        test('should allow an approver to approve a first submission and notify the organizers', async () => {
            mockAndCapture(approverMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'first approval' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.message).toEqual('Successfully changed approval status');
            await event.reload();
            expect(event.status).toEqual('first approval');
            expect(mails.map((mail) => mail.template)).toEqual(['summeruniversity_status_changed.html']);
            expect(mails[0].parameters.old_status).toEqual('first submission');
        });

        test('should allow an approver to reject a first submission back to first draft', async () => {
            mockAndCapture(approverMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'first draft' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.status).toEqual('first draft');
        });

        test('should allow an organizer to submit a first draft and notify SUCT', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first draft', published: 'none' });

            const res = await put(event, '/status', { status: 'first submission' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.status).toEqual('first submission');
            expect(mails.map((mail) => mail.template)).toEqual([
                'summeruniversity_status_changed.html',
                'summeruniversity_submitted.html'
            ]);
        });

        test.each([
            ['second submission', 'second approval'],
            ['second submission', 'second draft'],
            ['second approval', 'second submission'],
            ['first approval', 'first submission'],
            ['first approval', 'second submission']
        ])('should allow an approver to move the event from %s to %s', async (from, to) => {
            mockAndCapture(approverMocks);
            const event = await generator.createEvent({ status: from, published: 'none' });

            const res = await put(event, '/status', { status: to });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.status).toEqual(to);
        });

        test('should not allow an invalid transition', async () => {
            mockAndCapture(approverMocks);
            const event = await generator.createEvent({ status: 'second approval' });

            const res = await put(event, '/status', { status: 'first draft' });

            expect(res.statusCode).toEqual(403);
        });

        test('should return 403 on an unknown status', async () => {
            mockAndCapture(approverMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'totally approved' });

            expect(res.statusCode).toEqual(403);
        });

        // BUG: setApprovalStatus calls req.body.status.replace() without checking that
        // the status is set, so a missing status crashes with a 500 instead of a 4xx.
        test('should currently return 500 if the status is missing', async () => {
            mockAndCapture(approverMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', {});

            expect(res.statusCode).toEqual(500);
            await event.reload();
            expect(event.status).toEqual('first submission');
        });

        test('should return 500 and roll back if the mailer fails', async () => {
            mockAndCapture({ ...approverMocks, mailer: { unsuccessfulResponse: true } });
            const event = await generator.createEvent({ status: 'first submission', published: 'none' });

            const res = await put(event, '/status', { status: 'first approval' });

            expect(res.statusCode).toEqual(500);
            await event.reload();
            expect(event.status).toEqual('first submission');
        });
    });

    describe('PUT /single/:id/published', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);
            const event = await generator.createEvent();

            const res = await put(event, '/published', { published: 'none' });

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 for an organizer without manage permissions', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent();

            const res = await put(event, '/published', { published: 'none' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to set the publication.');
        });

        test('should return 403 if the user can only manage other types', async () => {
            mockAndCapture({ core: { notSuperadmin: true }, mainPermissions: { permissions: ['global:manage_summeruniversity:pilot'] } });
            const event = await generator.createEvent({ type: 'regular' });

            const res = await put(event, '/published', { published: 'none' });

            expect(res.statusCode).toEqual(403);
        });

        test('should return 400 on an invalid publication value', async () => {
            const event = await generator.createEvent();

            const res = await put(event, '/published', { published: 'everywhere' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('The wanted event publication status is not valid.');
        });

        test.each(['first draft', 'first submission'])('should not allow a minimal publication for %s', async (status) => {
            const event = await generator.createEvent({ status, published: 'none' });

            const res = await put(event, '/published', { published: 'minimal' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('This event status does not allow a minimal publication');
        });

        test('should not allow a full publication before second approval', async () => {
            const event = await generator.createEvent({ status: 'second submission', published: 'minimal' });

            const res = await put(event, '/published', { published: 'full' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('This event status does not allow a full publication');
        });

        test('should allow a minimal publication after first approval', async () => {
            const event = await generator.createEvent({ status: 'first approval', published: 'none' });

            const res = await put(event, '/published', { published: 'minimal' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toEqual('Successfully changed publication status');
            await event.reload();
            expect(event.published).toEqual('minimal');
        });

        test('should allow a full publication in second approval', async () => {
            const event = await generator.createEvent({ status: 'second approval', published: 'minimal' });

            const res = await put(event, '/published', { published: 'full' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.published).toEqual('full');
        });

        test('should always allow unpublishing', async () => {
            const event = await generator.createEvent({ status: 'first draft', published: 'minimal' });

            const res = await put(event, '/published', { published: 'none' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.published).toEqual('none');
        });
    });

    describe('PUT /single/:id/application_period', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);
            const event = await generator.createEvent();

            const res = await put(event, '/application_period', {});

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 for an organizer without manage permissions', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent();

            const res = await put(event, '/application_period', { application_ends: generator.daysFromNow(10) });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to set the application period.');
        });

        test('should return 403 if the event is not fully published', async () => {
            const event = await generator.createEvent({ status: 'first approval', published: 'minimal' });

            const res = await put(event, '/application_period', { application_ends: generator.daysFromNow(10) });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('This event status does not allow changing the application period');
        });

        test('should set the application period', async () => {
            const event = await generator.createEvent();
            const applicationStarts = generator.daysFromNow(2);
            const applicationEnds = generator.daysFromNow(12);

            const res = await put(event, '/application_period', { application_starts: applicationStarts, application_ends: applicationEnds });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toEqual('Successfully changed application period');
            expect(new Date(res.body.data.application_starts).toISOString()).toEqual(applicationStarts.toISOString());
            expect(new Date(res.body.data.application_ends).toISOString()).toEqual(applicationEnds.toISOString());
            expect(res.body.data.application_status).toEqual('closed');
        });

        test('should default the application start to now', async () => {
            const event = await generator.createEvent({ application_starts: generator.daysFromNow(5), application_ends: generator.daysFromNow(10) });
            const before = Date.now();

            const res = await put(event, '/application_period', { application_ends: generator.daysFromNow(20) });

            expect(res.statusCode).toEqual(200);
            expect(new Date(res.body.data.application_starts).getTime()).toBeGreaterThanOrEqual(before - 1000);
            expect(new Date(res.body.data.application_starts).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
            expect(res.body.data.application_status).toEqual('open');
        });

        test('should return 422 if the application period ends after the event starts', async () => {
            const event = await generator.createEvent({ starts: generator.daysFromNow(60) });

            const res = await put(event, '/application_period', { application_ends: generator.daysFromNow(70) });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.application_ends).toEqual(['Application period cannot end before or at the same time the event starts.']);
        });

        test('should return 422 if the application period ends before it starts', async () => {
            const event = await generator.createEvent();

            const res = await put(event, '/application_period', { application_starts: generator.daysFromNow(10), application_ends: generator.daysFromNow(5) });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('application_starts');
        });
    });

    describe('PUT /single/:id/open_call', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);
            const event = await generator.createEvent();

            const res = await put(event, '/open_call', { open_call: true });

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 for a stranger', async () => {
            mockAndCapture(strangerMocks);
            const event = await generator.createEvent();

            const res = await put(event, '/open_call', { open_call: true });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to change the open call period.');
        });

        test('should return 403 if the event is not fully published', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first approval', published: 'minimal' });

            const res = await put(event, '/open_call', { open_call: true });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('This event publication does not allow changing the open call period');
        });

        test('should allow an organizer to open the call', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ max_participants: 20 });

            const res = await put(event, '/open_call', { open_call: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toEqual('Successfully changed open call period');
            await event.reload();
            expect(event.open_call).toEqual(true);
            expect(event.max_participants).toEqual(20);
        });

        test('should only update open_call if max_participants is not given', async () => {
            const event = await generator.createEvent({ max_participants: 20 });

            const res = await put(event, '/open_call', { open_call: true, name: 'Should be ignored' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.name).not.toEqual('Should be ignored');
        });

        test('should update max_participants and recount the accepted participants', async () => {
            const event = await generator.createEvent({ max_participants: 20, accepted_participants: 0 });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });
            await generator.createApplication(event, { user_id: 11, status: 'accepted' });
            await generator.createApplication(event, { user_id: 12, status: 'accepted', cancelled: true });
            await generator.createApplication(event, { user_id: 13, status: 'pending' });

            const res = await put(event, '/open_call', { open_call: true, max_participants: 30 });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.max_participants).toEqual(30);
            expect(event.accepted_participants).toEqual(2);
            expect(event.available_spots).toEqual(28);
            expect(event.open_call).toEqual(true);
        });

        test('should close the open call in the database if no spots are left', async () => {
            const event = await generator.createEvent({ max_participants: 1 });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put(event, '/open_call', { open_call: true, max_participants: 1 });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.available_spots).toEqual(0);
            expect(event.open_call).toEqual(false);
        });

        test('should keep the open call if there is no max_participants', async () => {
            const event = await generator.createEvent({ max_participants: null, accepted_participants: null });

            const res = await put(event, '/open_call', { open_call: true });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.open_call).toEqual(true);
        });

        test('should allow closing the call', async () => {
            const event = await generator.createEvent({ open_call: true });

            const res = await put(event, '/open_call', { open_call: false });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.open_call).toEqual(false);
        });
    });

    describe('DELETE /single/:id', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);
            const event = await generator.createEvent();

            const res = await request({ path: '/single/' + event.id, method: 'DELETE', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(401);
        });

        test('should return 404 if the event does not exist', async () => {
            const res = await request({ path: '/single/1337', method: 'DELETE', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(404);
        });

        test('should return 403 for an organizer without manage permissions', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent();

            const res = await request({ path: '/single/' + event.id, method: 'DELETE', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not permitted to delete this event.');
            await event.reload();
            expect(event.deleted).toEqual(false);
        });

        test('should soft-delete the event for a manager', async () => {
            const event = await generator.createEvent();

            const res = await request({ path: '/single/' + event.id, method: 'DELETE', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.message).toEqual('Event successfully deleted');

            const dbEvent = await Event.findByPk(event.id);
            expect(dbEvent).not.toEqual(null);
            expect(dbEvent.deleted).toEqual(true);

            const listRes = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });
            expect(listRes.body.data).toEqual([]);
        });
    });
});
