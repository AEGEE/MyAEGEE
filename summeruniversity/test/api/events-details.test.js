const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');
const user = require('../assets/oms-core-valid.json').data;

const unauthorizedMocks = {
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
};

// User #5, not an organizer of the generated events, without any permissions.
const strangerMocks = {
    core: { notSuperadmin: true },
    mainPermissions: { noPermissions: true },
    approvePermissions: { noPermissions: true }
};

describe('Event details', () => {
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

    test('should return a published event by id without authentication', async () => {
        mock.mockAll(unauthorizedMocks);
        const event = await generator.createEvent();

        const res = await request({ path: '/single/' + event.id, method: 'GET' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).toEqual(event.id);
        expect(Object.keys(res.body.data).sort()).toEqual([...constants.EVENT_FULL_FIELDS].sort());
        expect(res.body.permissions.see_summeruniversity).toEqual(true);
        expect(res.body.permissions.edit_summeruniversity).toEqual(false);
        expect(res.body.permissions).not.toHaveProperty('apply');
    });

    test('should return an event by url', async () => {
        const event = await generator.createEvent({ url: 'my-summer-university' });

        const res = await request({ path: '/single/my-summer-university', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(event.id);
        expect(res.body.data.url).toEqual('my-summer-university');
    });

    test('should lowercase the url when saving', async () => {
        const event = await generator.createEvent({ url: 'My-SU ' });
        expect(event.url).toEqual('my-su');

        const res = await request({ path: '/single/my-su', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });
        expect(res.statusCode).toEqual(200);
    });

    test('should return 404 if the event is not found by id', async () => {
        const res = await request({ path: '/single/1337', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Event with id 1337 not found');
    });

    test('should return 404 if the event is not found by url', async () => {
        const res = await request({ path: '/single/nonexistent-url', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual('Event with id nonexistent-url not found');
    });

    test('should return 404 for a negative id', async () => {
        const res = await request({ path: '/single/-1', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(404);
    });

    test('should return 404 for a non-integer numeric id', async () => {
        const res = await request({ path: '/single/1.5', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(404);
    });

    test('should return 404 for an id out of the integer range', async () => {
        const res = await request({ path: '/single/99999999999', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(404);
    });

    test('should return the minimal fields for a minimally published event', async () => {
        mock.mockAll(strangerMocks);
        const event = await generator.createEvent({ published: 'minimal', status: 'first approval' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(Object.keys(res.body.data).sort()).toEqual([...constants.EVENT_MINIMAL_FIELDS].sort());
    });

    test('should not show an unpublished event to a stranger', async () => {
        mock.mockAll(strangerMocks);
        const event = await generator.createEvent({ published: 'none', status: 'first draft' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('You cannot see this event.');
    });

    test('should not show a deleted event to a stranger', async () => {
        mock.mockAll(strangerMocks);
        const event = await generator.createEvent({ deleted: true });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(403);
    });

    test('should show an unpublished event with all fields to an organizer without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ published: 'none', status: 'first draft' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveProperty('organizers');
        expect(res.body.data).toHaveProperty('programme_suct');
        expect(res.body.data).toHaveProperty('budget');
        expect(res.body.permissions.edit_summeruniversity).toEqual(true);
        expect(res.body.permissions.delete_summeruniversity).toEqual(false);
        expect(res.body.permissions.list_applications).toEqual(true);
        expect(res.body.permissions.change_status.first_submission).toEqual(true);
        expect(res.body.permissions.change_status.first_approval).toEqual(false);
    });

    test('should show an unpublished event with all fields to an approver who is not an organizer', async () => {
        mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { permissions: ['global:approve_summeruniversity:regular'] } });
        const event = await generator.createEvent({ published: 'none', status: 'first submission' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveProperty('organizers');
        expect(res.body.permissions.change_status.first_approval).toEqual(true);
        expect(res.body.permissions.change_status.first_draft).toEqual(true);
        expect(res.body.permissions.edit_summeruniversity).toEqual(false);
    });

    test('should not allow organizers to edit an event in second approval', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ status: 'second approval' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.permissions.edit_summeruniversity).toEqual(false);
    });

    test('should give full permissions to a manager', async () => {
        const event = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveProperty('organizers');
        expect(res.body.permissions.edit_summeruniversity).toEqual(true);
        expect(res.body.permissions.delete_summeruniversity).toEqual(true);
        expect(res.body.permissions.export_pax).toEqual(true);
    });

    test('should not show an unpublished event of another type to an approver', async () => {
        mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { permissions: ['global:approve_summeruniversity:pilot'] } });
        const event = await generator.createEvent({ type: 'regular', published: 'none', status: 'first submission' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You cannot see this event.');
    });

    test('should only show the public fields of a published event to an approver of another type', async () => {
        mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { permissions: ['global:approve_summeruniversity:pilot'] } });
        const event = await generator.createEvent({ type: 'regular' });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(Object.keys(res.body.data).sort()).toEqual([...constants.EVENT_FULL_FIELDS].sort());
        expect(res.body.permissions.change_status.second_submission).toEqual(false);
    });

    test('should not offer applying to a deleted, published and open event', async () => {
        mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { permissions: ['global:apply:summeruniversity'] } });
        const event = await generator.createEvent({ deleted: true, organizers: generator.generateOrganizers(5) });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.permissions.apply).toEqual(false);
    });

    describe('apply permission', () => {
        const applicantMocks = {
            core: { notSuperadmin: true },
            mainPermissions: { permissions: ['global:apply:summeruniversity'] },
            approvePermissions: { noPermissions: true }
        };

        test('should allow applying to an open, fully published event', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent();

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(true);
            expect(res.body.permissions.see_own_application).toEqual(false);
        });

        test('should not allow applying without the apply permission', async () => {
            mock.mockAll(strangerMocks);
            const event = await generator.createEvent();

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(false);
        });

        test('should not allow applying if the applications are closed', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10) });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(false);
        });

        test('should not allow applying if the event is only minimally published', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent({ published: 'minimal', status: 'first approval' });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(false);
        });

        test('should not allow applying if the user has an active application for another 2026 event', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent();
            const otherEvent = await generator.createEvent();
            await generator.createApplication(otherEvent, { user_id: 5 });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(false);
        });

        test('should not allow applying if the user has an active application for another event in the event\'s season', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent({ season: 2025 });
            await generator.createApplication(await generator.createEvent({ season: 2025 }), { user_id: 5 });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(false);
        });

        test('should allow applying to an event in another season than the user\'s active application', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent({ season: 2025 });
            await generator.createApplication(await generator.createEvent({ season: 2026 }), { user_id: 5 });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(true);
        });

        test('should allow applying if the application for another event was rejected or cancelled, or in another season', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent();
            await generator.createApplication(await generator.createEvent(), { user_id: 5, status: 'rejected' });
            await generator.createApplication(await generator.createEvent(), { user_id: 5, cancelled: true });
            await generator.createApplication(await generator.createEvent({ season: 2025 }), { user_id: 5 });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(true);
        });

        test('should allow re-applying (editing) while the own application is pending and show it', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent();
            await generator.createApplication(event, { user_id: 5 });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(true);
            expect(res.body.permissions.see_own_application).toEqual(true);
        });

        test('should not allow applying once accepted for this event', async () => {
            mock.mockAll(applicantMocks);
            const event = await generator.createEvent();
            await generator.createApplication(event, { user_id: 5, status: 'accepted' });

            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.permissions.apply).toEqual(false);
        });
    });

    test('should expose the virtual fields', async () => {
        const event = await generator.createEvent({ max_participants: 20, accepted_participants: 5, organizers: generator.generateOrganizers(user.id) });

        const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.body.data.available_spots).toEqual(15);
        expect(res.body.data.application_status).toEqual('open');
    });
    describe('event ids that are not stored ids', () => {
        test.each(['1.5', '99999999999', 'Infinity', '1e3', '-1'])('should return 404 for /single/%s', async (id) => {
            await generator.createEvent();

            const res = await request({
                path: '/single/' + id,
                headers: { 'X-Auth-Token': 'foobar' },
                method: 'GET'
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
        });
    });
    test('should find an event by its URL in any letter case', async () => {
        const event = await generator.createEvent({ url: 'case-test-event' });

        const res = await request({
            path: '/single/Case-Test-EVENT',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(event.id);
    });
});
