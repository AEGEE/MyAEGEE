const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const coreUser = require('../assets/oms-core-valid.json').data;

const unauthorizedMocks = {
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
};

// The organizer (user #1, board member of body 34) without any global permissions.
const organizerMocks = { mainPermissions: { noPermissions: true } };

// User #5, not an organizer, without any permissions.
const strangerMocks = { core: { notSuperadmin: true }, mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } };

// User #5 who can apply.
const applicantMocks = { ...strangerMocks, mainPermissions: { permissions: ['global:apply:summeruniversity'] } };

// User #5, not an organizer, who manages Summer Universities of the type regular.
const managerMocks = { ...strangerMocks, mainPermissions: { permissions: ['global:manage_summeruniversity:regular'] } };

describe('Applications status changes', () => {
    let event;
    let application;
    let mails;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mails = mock.captureMails(mock.mockAll(organizerMocks).omsMailerStub);
        event = await generator.createEvent({ max_participants: 20, accepted_participants: 0 });
        application = await generator.createApplication(event, { user_id: 5, body_id: 34 });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const mockAndCapture = (options) => {
        mails = mock.captureMails(mock.mockAll(options).omsMailerStub);
    };

    const put = (subpath, body, applicationId = application.id) => request({
        path: '/single/' + event.id + '/applications/' + applicationId + subpath,
        method: 'PUT',
        headers: { 'X-Auth-Token': 'foobar' },
        body
    });

    describe.each(['/attended', '/confirmed', '/cancelled', '/status', '/comment'])('PUT %s (common checks)', (subpath) => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await put(subpath, {});

            expect(res.statusCode).toEqual(401);
        });

        test('should return 404 if the application does not exist', async () => {
            const res = await put(subpath, {}, 1337);

            expect(res.statusCode).toEqual(404);
        });

        test('should return 400 on an invalid application id', async () => {
            const res = await put(subpath, {}, 'abc');

            expect(res.statusCode).toEqual(400);
        });

        test('should return 403 for a stranger', async () => {
            mockAndCapture(strangerMocks);
            const other = await generator.createApplication(event, { user_id: 10, body_id: 1 });

            const res = await put(subpath, { attended: true, confirmed: true, cancelled: true, status: 'accepted', board_comment: 'x' }, other.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
        });
    });

    describe.each([
        ['/attended', { attended: null }],
        ['/confirmed', { confirmed: null }],
        ['/cancelled', { cancelled: null }],
        ['/status', { status: null }],
        ['/comment', { board_comment: 42 }]
    ])('PUT %s without a valid value', (subpath, invalid) => {
        test.each([
            ['no value', {}],
            ['an invalid value', invalid]
        ])('should return 422 for %s and change nothing', async (name, body) => {
            const before = (await application.reload()).toJSON();

            const res = await put(subpath, body);

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
            expect(res.body.success).toEqual(false);
            expect(mails).toHaveLength(0);
            await application.reload();
            expect(application.toJSON()).toEqual(before);
        });
    });

    describe('PUT /confirmed', () => {
        test('should allow an organizer to confirm an application', async () => {
            await application.update({ status: 'accepted' });

            const res = await put('/confirmed', { confirmed: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.confirmed).toEqual(true);
            await application.reload();
            expect(application.confirmed).toEqual(true);
        });

        test('should return 422 on a non-boolean value', async () => {
            const res = await put('/confirmed', { confirmed: 'maybe' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.confirmed).toContain('The value should be true or false.');
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
        });

        test('should not allow unconfirming an attended application', async () => {
            await application.update({ confirmed: true, attended: true });

            const res = await put('/confirmed', { confirmed: false });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.confirmed).toEqual(['This application is marked as attended, you cannot mark it as not confirmed.']);
        });

        test('should return 403 for the applicant', async () => {
            mockAndCapture(applicantMocks);

            const res = await put('/confirmed', { confirmed: true });

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('PUT /attended', () => {
        test('should allow an organizer to mark a confirmed application as attended', async () => {
            await application.update({ confirmed: true });

            const res = await put('/attended', { attended: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.attended).toEqual(true);
            await application.reload();
            expect(application.attended).toEqual(true);
        });

        test('should not allow marking an unconfirmed application as attended', async () => {
            const res = await put('/attended', { attended: true });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.attended).toEqual(['This application is not marked as confirmed, you cannot mark it as attended.']);
        });

        test('should return 403 for the applicant', async () => {
            mockAndCapture(applicantMocks);

            const res = await put('/attended', { attended: false });

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('PUT /cancelled', () => {
        test('should allow an organizer to cancel an application and recount the accepted participants', async () => {
            await application.update({ status: 'accepted' });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });
            await event.update({ accepted_participants: 2 });

            const res = await put('/cancelled', { cancelled: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.cancelled).toEqual(true);
            await event.reload();
            expect(event.accepted_participants).toEqual(1);
        });

        test('should allow the applicant to cancel their own application', async () => {
            mockAndCapture(applicantMocks);

            const res = await put('/cancelled', { cancelled: true }, 'me');

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.cancelled).toEqual(true);
        });

        test('should not allow the applicant to cancel once the applications are closed', async () => {
            mockAndCapture(applicantMocks);
            await event.update({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10) });

            const res = await put('/cancelled', { cancelled: true }, 'me');

            expect(res.statusCode).toEqual(403);
        });

        test('should return 422 on a non-boolean value', async () => {
            const res = await put('/cancelled', { cancelled: 'yes' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
        });
    });

    describe('PUT /status', () => {
        test('should allow an organizer to accept an application and notify the applicant', async () => {
            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.status).toEqual('accepted');

            await application.reload();
            expect(application.status).toEqual('accepted');
            await event.reload();
            expect(event.accepted_participants).toEqual(1);

            expect(mails.map((mail) => mail.template)).toEqual(['summeruniversity_application_status_updated.html']);
            expect(mails[0].to).toEqual(coreUser.notification_email);
        });

        test('should allow rejecting an application', async () => {
            await application.update({ status: 'accepted' });

            const res = await put('/status', { status: 'rejected' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.accepted_participants).toEqual(0);
        });

        test('should return 422 on an invalid status', async () => {
            const res = await put('/status', { status: 'maybe' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('status');
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
            await application.reload();
            expect(application.status).toEqual('pending');
            expect(mails.length).toEqual(0);
        });

        test('should return 403 for the applicant', async () => {
            mockAndCapture(applicantMocks);

            const res = await put('/status', { status: 'accepted' }, 'me');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to accept or reject participants');
        });

        test('should return 500 and roll back if the mailer fails', async () => {
            mockAndCapture({ ...organizerMocks, mailer: { badResponse: true } });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(500);
            await application.reload();
            expect(application.status).toEqual('pending');
        });
    });

    describe('PUT /comment', () => {
        test('should allow a board member of the application body to set a comment', async () => {
            const res = await put('/comment', { board_comment: 'Good member' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.board_comment).toEqual('Good member');
            await application.reload();
            expect(application.board_comment).toEqual('Good member');
        });

        test('should not allow commenting on an application from another body', async () => {
            const other = await generator.createApplication(event, { user_id: 10, body_id: 1 });

            const res = await put('/comment', { board_comment: 'x' }, other.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to put board comments');
        });

        test('should not allow commenting without the approve members permission', async () => {
            mockAndCapture({ ...organizerMocks, approvePermissions: { noPermissions: true } });

            const res = await put('/comment', { board_comment: 'x' });

            expect(res.statusCode).toEqual(403);
        });
    });
    describe('participant counts and states', () => {
        test('should not accept more participants than max_participants', async () => {
            await event.update({ max_participants: 1 });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty('status');
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
            await application.reload();
            expect(application.status).toEqual('pending');
            expect(mails).toHaveLength(0);
        });

        test('should not count cancelled applications against max_participants', async () => {
            await event.update({ max_participants: 1 });
            await generator.createApplication(event, { user_id: 10, status: 'accepted', cancelled: true });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.status).toEqual('accepted');
        });

        test('should accept without a limit if max_participants is not set', async () => {
            await event.update({ max_participants: null });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(200);
        });

        test('should not open the call when the event is over capacity', async () => {
            await event.update({ max_participants: 5, open_call: false });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });
            await generator.createApplication(event, { user_id: 11, status: 'accepted' });

            const res = await request({
                path: '/single/' + event.id + '/open_call',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'foobar' },
                body: { open_call: true, max_participants: 1 }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.open_call).toEqual(['The open call needs a free spot: max_participants should be more than the 2 accepted participants.']);
            expect(res.body.message).toEqual(res.body.errors.open_call[0]);
            await event.reload();
            expect(event.max_participants).toEqual(5);
            expect(event.open_call).toEqual(false);
        });

        test('should not accept an application again that was accepted before when the event is full', async () => {
            await event.update({ max_participants: 1 });
            await application.update({ status: 'accepted' });
            await application.update({ status: 'rejected' });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.status).toEqual(['There are no spots left: the event already has max_participants accepted participants.']);
            await application.reload();
            expect(application.status).toEqual('rejected');
        });

        // A cancelled application does not count, so accepting it takes no spot.
        test('should accept a cancelled application when the event is full', async () => {
            await event.update({ max_participants: 1 });
            await application.update({ cancelled: true });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.status).toEqual('accepted');
            await event.reload();
            expect(event.accepted_participants).toEqual(1);
        });

        test('should let a manager of the type accept when the event is full', async () => {
            mockAndCapture(managerMocks);
            await event.update({ max_participants: 1 });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.status).toEqual('accepted');
            await event.reload();
            expect(event.accepted_participants).toEqual(2);
        });

        // The applicant cannot take it back at all: once accepted, they may not apply to it.
        test('should not let an organizer take back the cancellation of an accepted application when the event is full', async () => {
            await event.update({ max_participants: 1 });
            await application.update({ status: 'accepted', cancelled: true });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/cancelled', { cancelled: false });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.cancelled).toEqual(['There are no spots left: the event already has max_participants accepted participants.']);
            expect(res.body.message).toEqual(res.body.errors.cancelled[0]);
            await application.reload();
            expect(application.cancelled).toEqual(true);
        });

        test('should let a manager of the type take back the cancellation of an accepted application when the event is full', async () => {
            mockAndCapture(managerMocks);
            await event.update({ max_participants: 1 });
            await application.update({ status: 'accepted', cancelled: true });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/cancelled', { cancelled: false });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.cancelled).toEqual(false);
        });

        test('should take back the cancellation of a pending application when the event is full', async () => {
            await event.update({ max_participants: 1 });
            await application.update({ cancelled: true });
            await generator.createApplication(event, { user_id: 10, status: 'accepted' });

            const res = await put('/cancelled', { cancelled: false });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.cancelled).toEqual(false);
        });

        test.each(['rejected', 'pending'])('should clear the confirmation when an accepted application becomes %s', async (status) => {
            await application.update({ status: 'accepted', confirmed: true });

            const res = await put('/status', { status });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.confirmed).toEqual(false);
            await application.reload();
            expect(application.status).toEqual(status);
            expect(application.confirmed).toEqual(false);
        });

        test('should keep the confirmation when an accepted application is accepted again', async () => {
            await application.update({ status: 'accepted', confirmed: true });

            const res = await put('/status', { status: 'accepted' });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.confirmed).toEqual(true);
        });

        test('should not change the status of an application marked as attended', async () => {
            await application.update({ status: 'accepted', confirmed: true, attended: true });

            const res = await put('/status', { status: 'rejected' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.status).toEqual(['This application is marked as attended: mark it as not attended before changing its status.']);
            expect(res.body.message).toEqual(res.body.errors.status[0]);
            await application.reload();
            expect(application.status).toEqual('accepted');
            expect(application.confirmed).toEqual(true);
            expect(mails).toHaveLength(0);
        });

        test.each([
            ['pending', 'pending', false],
            ['rejected', 'rejected', false],
            ['cancelled', 'accepted', true]
        ])('should not confirm a %s application', async (name, status, cancelled) => {
            await application.update({ status, cancelled });

            const res = await put('/confirmed', { confirmed: true });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('confirmed');
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
            await application.reload();
            expect(application.confirmed).toEqual(false);
        });

        test('should confirm an accepted application', async () => {
            await application.update({ status: 'accepted' });

            const res = await put('/confirmed', { confirmed: true });

            expect(res.statusCode).toEqual(200);
            await application.reload();
            expect(application.confirmed).toEqual(true);
        });

        test('should not let a banned applicant take back their cancellation', async () => {
            mockAndCapture({
                core: { eventApplicationBanned: true },
                mainPermissions: { permissions: ['global:apply:summeruniversity'] },
                approvePermissions: { noPermissions: true }
            });
            const ownEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            const own = await generator.createApplication(ownEvent, { user_id: coreUser.id, cancelled: true });

            const res = await request({
                path: '/single/' + ownEvent.id + '/applications/me/cancelled',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'foobar' },
                body: { cancelled: false }
            });

            expect(res.statusCode).toEqual(403);
            await own.reload();
            expect(own.cancelled).toEqual(true);
        });

        test('should let a banned applicant cancel', async () => {
            mockAndCapture({
                core: { eventApplicationBanned: true },
                mainPermissions: { permissions: ['global:apply:summeruniversity'] },
                approvePermissions: { noPermissions: true }
            });
            const ownEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            const own = await generator.createApplication(ownEvent, { user_id: coreUser.id });

            const res = await request({
                path: '/single/' + ownEvent.id + '/applications/me/cancelled',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'foobar' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(200);
            await own.reload();
            expect(own.cancelled).toEqual(true);
        });
    });
});
