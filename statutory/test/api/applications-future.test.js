const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/core-valid.json').data;

describe('Statutory future applications', () => {
    beforeEach(async () => {
        await startServer();
    });

    afterEach(async () => {
        tk.reset();
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    // An event with every deadline in order before the moment it starts.
    const createEventStartingAt = (starts, options = {}) => generator.createEvent({
        application_period_starts: moment(starts).subtract(5, 'weeks').toDate(),
        application_period_ends: moment(starts).subtract(4, 'weeks').toDate(),
        board_approve_deadline: moment(starts).subtract(3, 'weeks').toDate(),
        participants_list_publish_deadline: moment(starts).subtract(2, 'weeks').toDate(),
        memberslist_submission_deadline: moment(starts).subtract(1, 'week').toDate(),
        starts: moment(starts).toDate(),
        ends: moment(starts).add(1, 'week').toDate(),
        applications: [],
        ...options
    });

    const listFor = (userId) => request({
        path: '/applications/future/' + userId,
        headers: { 'X-Auth-Token': 'foobar' }
    });

    test('should allow application ban managers to list future applications without statutory management permissions', async () => {
        mock.mockAll({ mainPermissions: { applicationBanPermission: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            name: 'Future statutory event',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            board_approve_deadline: moment().add(2, 'weeks').toDate(),
            participants_list_publish_deadline: moment().add(3, 'weeks').toDate(),
            memberslist_submission_deadline: moment().add(4, 'weeks').toDate(),
            starts: moment().add(1, 'month').toDate(),
            ends: moment().add(1, 'month').add(1, 'day').toDate(),
            status: 'published',
            applications: []
        });
        await generator.createApplication({
            user_id: user.id,
            status: 'pending',
            cancelled: false
        }, event);

        const res = await request({
            path: '/applications/future/' + user.id,
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({
            service: 'statutory',
            event_id: event.id,
            event_name: 'Future statutory event',
            application_status: 'pending'
        });
    });

    test('should reject users without application ban or statutory management permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const res = await request({
            path: '/applications/future/' + user.id,
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should return 400 if the user ID is above the maximum ID', async () => {
        mock.mockAll({ mainPermissions: { applicationBanPermission: true }, approvePermissions: { noPermissions: true } });

        const res = await request({
            path: '/applications/future/2147483648',
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('User ID should be a number.');
    });

    describe('who may list them', () => {
        // The permission for one event type opens the applications to events of every type.
        test.each(['agora', 'epm', 'spm'])('global:manage_applications:%s alone lists the applications to every type of event', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:manage_applications:${type}`] } });

            const agora = await createEventStartingAt(moment().add(2, 'months'), { type: 'agora' });
            const epm = await createEventStartingAt(moment().add(3, 'months'), { type: 'epm' });
            await generator.createApplication({ user_id: 1337 }, agora);
            await generator.createApplication({ user_id: 1337 }, epm);

            const res = await listFor(1337);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.map((row) => [row.event_id, row.event_type])).toEqual([
                [agora.id, 'agora'],
                [epm.id, 'epm']
            ]);
        });

        test.each([
            'global:manage_incoming:agora',
            'global:manage_juridical:agora',
            'global:update_memberslist_status:agora',
            'global:approve_members:agora',
            'global:manage_event:agora',
            'global:apply:agora'
        ])('%s alone answers 403', async (permission) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await createEventStartingAt(moment().add(2, 'months'));
            await generator.createApplication({ user_id: 1337 }, event);

            const res = await listFor(1337);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
            expect(res.body).not.toHaveProperty('data');
        });

        test('should refuse members their own future applications', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await createEventStartingAt(moment().add(2, 'months'));
            await generator.createApplication({ user_id: user.id }, event);

            const res = await listFor(user.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body).not.toHaveProperty('data');
        });
    });

    test.each(['-1', '1.5', '1e3', '0x10', '%201'])('should return 400 for the user ID "%s"', async (userId) => {
        mock.mockAll({ mainPermissions: { applicationBanPermission: true } });

        const res = await listFor(userId);

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'User ID should be a number.' });
    });

    test('should return an empty list for a user without applications', async () => {
        mock.mockAll({ mainPermissions: { applicationBanPermission: true } });

        const event = await createEventStartingAt(moment().add(2, 'months'));
        await generator.createApplication({ user_id: 1337 }, event);

        const res = await listFor(2147483647);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, data: [] });
    });

    describe('the applications that are listed', () => {
        beforeEach(() => {
            mock.mockAll({ mainPermissions: { applicationBanPermission: true } });
        });

        test('should list pending, waiting list and accepted applications with their real status, the earliest event first', async () => {
            const third = await createEventStartingAt(moment().add(4, 'months'), { name: 'Third' });
            const first = await createEventStartingAt(moment().add(2, 'months'), { name: 'First' });
            const second = await createEventStartingAt(moment().add(3, 'months'), { name: 'Second' });

            const accepted = await generator.createApplication({ user_id: 1337, status: 'accepted' }, third);
            const pending = await generator.createApplication({ user_id: 1337, status: 'pending' }, first);
            const waiting = await generator.createApplication({ user_id: 1337, status: 'waiting_list' }, second);

            const res = await listFor(1337);

            expect(res.statusCode).toEqual(200);
            // The statuses are not hidden here, although none of the events has revealed them yet.
            expect(res.body.data).toEqual([
                {
                    service: 'statutory',
                    application_id: pending.id,
                    application_status: 'pending',
                    event_id: first.id,
                    event_name: 'First',
                    event_type: first.type,
                    event_starts: first.starts.toISOString()
                },
                {
                    service: 'statutory',
                    application_id: waiting.id,
                    application_status: 'waiting_list',
                    event_id: second.id,
                    event_name: 'Second',
                    event_type: second.type,
                    event_starts: second.starts.toISOString()
                },
                {
                    service: 'statutory',
                    application_id: accepted.id,
                    application_status: 'accepted',
                    event_id: third.id,
                    event_name: 'Third',
                    event_type: third.type,
                    event_starts: third.starts.toISOString()
                }
            ]);
        });

        test('should leave out cancelled and rejected applications, events that started, drafts and other members', async () => {
            const future = () => moment().add(2, 'months');

            const listed = await generator.createApplication({ user_id: 1337 }, await createEventStartingAt(future()));

            await generator.createApplication({ user_id: 1337, cancelled: true }, await createEventStartingAt(future()));
            await generator.createApplication({ user_id: 1337, status: 'rejected' }, await createEventStartingAt(future()));
            await generator.createApplication({ user_id: 1337 }, await createEventStartingAt(moment().subtract(1, 'day')));
            await generator.createApplication({ user_id: 1337 }, await createEventStartingAt(future(), { status: 'draft' }));
            await generator.createApplication({ user_id: 1338 }, await createEventStartingAt(future()));

            const res = await listFor(1337);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((row) => row.application_id)).toEqual([listed.id]);
        });

        // An event counts as future until the moment it starts.
        test.each([
            ['lists an application 1 ms before the event starts', -1, 1],
            ['leaves an application out exactly when the event starts (exclusive)', 0, 0],
            ['leaves an application out 1 ms after the event starts', 1, 0]
        ])('%s', async (name, offset, count) => {
            const event = await createEventStartingAt(moment().add(2, 'months'));
            await generator.createApplication({ user_id: 1337 }, event);

            tk.freeze(moment(event.starts).add(offset, 'ms').toDate());

            const res = await listFor(1337);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(count);
        });
    });
});
