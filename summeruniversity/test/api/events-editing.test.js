const xlsx = require('node-xlsx').default;

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

    describe('type and fee permissions', () => {
        test('should not let an organizer without edit:su_type change the type', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none', type: 'regular' });

            const res = await editEvent(event, { type: 'pilot' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            await event.reload();
            expect(event.type).toEqual('regular');
            expect(mails).toHaveLength(0);
        });

        test('should not let a manager without edit:su_type change the type', async () => {
            const event = await generator.createEvent({ status: 'second approval', type: 'regular' });

            const res = await editEvent(event, { type: 'pilot' });

            expect(res.statusCode).toEqual(403);
            await event.reload();
            expect(event.type).toEqual('regular');
        });

        test('should let an organizer send the type unchanged', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none', type: 'regular' });

            const res = await editEvent(event, { type: 'regular', name: 'Changed' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.name).toEqual('Changed');
        });

        test('should let an organizer with edit:su_type change the type', async () => {
            mockAndCapture({ mainPermissions: { permissions: ['global:edit:su_type'] } });
            const event = await generator.createEvent({ status: 'first submission', published: 'none', type: 'regular' });

            const res = await editEvent(event, { type: 'pilot' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.type).toEqual('pilot');
        });

        test('should not let an organizer without edit:su_fee change the fee after the first submission', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none', fee: 50 });

            const res = await editEvent(event, { fee: 60 });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            await event.reload();
            expect(Number(event.fee)).toEqual(50);
        });

        test('should not let a manager without edit:su_fee change the fee', async () => {
            const event = await generator.createEvent({ status: 'second approval', fee: 50 });

            const res = await editEvent(event, { fee: 60 });

            expect(res.statusCode).toEqual(403);
            await event.reload();
            expect(Number(event.fee)).toEqual(50);
        });

        test('should let an organizer send the fee unchanged', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none', fee: 50 });

            const res = await editEvent(event, { fee: '50.00', name: 'Changed' });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.name).toEqual('Changed');
        });

        test('should let an organizer change the fee of a first draft', async () => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first draft', published: 'none', fee: 50 });

            const res = await editEvent(event, { fee: 60 });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(Number(event.fee)).toEqual(60);
        });

        test('should let an organizer with edit:su_fee change the fee after the first submission', async () => {
            mockAndCapture({ mainPermissions: { permissions: ['global:edit:su_fee'] } });
            const event = await generator.createEvent({ status: 'first approval', published: 'none', fee: 50 });

            const res = await editEvent(event, { fee: 60 });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(Number(event.fee)).toEqual(60);
        });

        test.each([
            ['an array', ['pilot']],
            ['an object', { type: 'pilot' }],
            ['a number', 1],
            ['an unknown type', 'garbage']
        ])('should answer 422 for a type that is %s, also without edit:su_type', async (_name, type) => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none', type: 'regular' });

            const res = await editEvent(event, { type });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('type');
            await event.reload();
            expect(event.type).toEqual('regular');
            expect(mails).toHaveLength(0);
        });

        test.each([
            ['null', null],
            ['empty', ''],
            ['not a number', 'abc'],
            ['negative', -5]
        ])('should answer 422 for a fee that is %s, also without edit:su_fee', async (_name, fee) => {
            mockAndCapture(organizerMocks);
            const event = await generator.createEvent({ status: 'first submission', published: 'none', fee: 50 });

            const res = await editEvent(event, { fee });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('fee');
            await event.reload();
            expect(Number(event.fee)).toEqual(50);
            expect(mails).toHaveLength(0);
        });
    });

    test.each([
        ['theme_category', 'sports'],
        ['pax_confirmation', 'payment'],
        ['course_level', 'beginner']
    ])('should answer 422 for a %s that is not a string', async (field, value) => {
        const event = await generator.createEvent({ status: 'second approval' });
        const stored = event.toJSON()[field];

        for (const sent of [[value], { [field]: value }, 1]) {
            const res = await editEvent(event, { [field]: sent });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
        }
        await event.reload();
        expect(event[field]).toEqual(stored);
    });

    describe('dates on partial edits', () => {
        test.each([
            ['starts before the application period ends', { starts: generator.daysFromNow(20) }, 'application_ends'],
            ['starts after the event ends', { starts: generator.daysFromNow(80) }, 'ends']
        ])('should return 422 if only %s is changed', async (name, body, field) => {
            const event = await generator.createEvent({
                application_ends: generator.daysFromNow(30),
                starts: generator.daysFromNow(60),
                ends: generator.daysFromNow(70)
            });

            const res = await editEvent(event, body);

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty(field);

            const startsBefore = event.starts.getTime();
            await event.reload();
            expect(event.starts.getTime()).toEqual(startsBefore);
        });

        test('should accept a partial edit that keeps the dates in order', async () => {
            const event = await generator.createEvent({
                application_ends: generator.daysFromNow(30),
                starts: generator.daysFromNow(60),
                ends: generator.daysFromNow(70)
            });
            const starts = generator.daysFromNow(50);

            const res = await editEvent(event, { starts });

            expect(res.statusCode).toEqual(200);
            await event.reload();
            expect(event.starts.getTime()).toEqual(starts.getTime());
        });
    });

    test('should let an organizer change the questions after applications exist', async () => {
        mockAndCapture(organizerMocks);
        const event = await generator.createEvent({ status: 'first approval', published: 'minimal', questions: [{ description: 'Why?' }] });
        const application = await generator.createApplication(event, { user_id: 2 });

        const res = await editEvent(event, { questions: [{ description: 'Why?' }, { description: 'Where from?' }] });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.questions).toHaveLength(2);
        await application.reload();
        expect(application.answers).toHaveLength(1);

        // The existing application keeps one answer; the export lists the new questions.
        mock.mockAll();
        const exportRes = await request({
            path: '/single/' + event.id + '/applications/export',
            method: 'GET',
            headers: { 'X-Auth-Token': 'foobar' },
            responseType: 'buffer'
        });
        expect(exportRes.statusCode).toEqual(200);
        const [sheet] = xlsx.parse(exportRes.body);
        expect(sheet.data[0].slice(-2)).toEqual(['Answer 1: Why?', 'Answer 2: Where from?']);
    });

    test('should return 422 if the questions are null', async () => {
        const event = await generator.createEvent({ status: 'first approval', published: 'minimal' });

        const res = await editEvent(event, { questions: null });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.questions).toEqual(['Event questions should be a list.']);
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

    test.each([
        ['organizing_bodies', 'notFound'],
        ['organizing_bodies', 'forbidden'],
        ['cooperation', 'notFound']
    ])('should return 422 if a body in %s cannot be fetched (%s)', async (field, failure) => {
        mockAndCapture({ body: { [failure]: true } });
        const event = await generator.createEvent();

        const res = await editEvent(event, { [field]: [{ body_id: 4242 }] });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty(field);
        expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
        const before = event[field];
        await event.reload();
        expect(event[field]).toEqual(before);
    });

    test('should return 500 if fetching a body fails', async () => {
        mockAndCapture({ body: { netError: true } });
        const event = await generator.createEvent();

        const res = await editEvent(event, { organizing_bodies: [{ body_id: 34 }] });

        expect(res.statusCode).toEqual(500);
    });
});
