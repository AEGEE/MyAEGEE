const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Attendance } = require('../../models');

describe('Plenary attendance marking', () => {
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
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    // The plenaries are for the Agora only: the type of the event is checked before anything else.
    test.each(['epm', 'spm'])('answers 400 for an %s event and stores nothing', async (type) => {
        const event = await generator.createEvent({ type, applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.message).toContain('Agora');
        expect(await Attendance.count()).toEqual(0);
    });

    test('should fail if no permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary is not found', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/1337/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary_id is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/NaN/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if application is not found', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test.each([
        ['a non-integer string', (id) => id + '.0'],
        ['a non-integer number', (id) => id + 0.5]
    ])('should fail if application ID is %s', async (description, makeId) => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: makeId(application.id) }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if applicant is not a delegate', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'visitor',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if it\'s too late', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            starts: moment().subtract(2, 'days').toDate(),
            ends: moment().subtract(1, 'days').toDate()
        }, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed and create new plenary attendance if there is none', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(1);
        expect(res.body.data.id).toEqual(attendanceFromDb[0].id);
        expect(attendanceFromDb[0].ends).toEqual(null);
    });

    test('should succeed and create new plenary attendance if there are some', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);
        await generator.createAttendance({
            plenary_id: plenary.id,
            application_id: application.id,
        });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(2);
    });

    test('should succeed and update existing attendance if it exists', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);
        await generator.createAttendance({
            plenary_id: plenary.id,
            application_id: application.id,
            starts: moment().subtract(1, 'hour').toDate(),
            ends: null
        });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(1);
        expect(res.body.data.id).toEqual(attendanceFromDb[0].id);
        expect(attendanceFromDb[0].ends).not.toEqual(null);
    });

    test('should fail if ends < starts', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);
        await generator.createAttendance({
            plenary_id: plenary.id,
            application_id: application.id,
            starts: moment().add(1, 'hour').toDate(),
            ends: null
        });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should find application by statutory_id', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            status: 'accepted',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.statutory_id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(1);
        expect(res.body.data.id).toEqual(attendanceFromDb[0].id);
        expect(attendanceFromDb[0].ends).toEqual(null);
    });

    // A plenary on a fixed day, two hours long.
    const STARTS = '2030-03-01T10:00:00.000Z';
    const ENDS = '2030-03-01T12:00:00.000Z';

    const createAgoraWithPlenary = async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({ starts: new Date(STARTS), ends: new Date(ENDS) }, event);
        return { event, plenary };
    };

    const mark = (event, plenary, applicationId) => request({
        path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body: { application_id: applicationId }
    });

    describe('who may mark attendance', () => {
        let event;
        let plenary;
        let delegate;

        beforeEach(async () => {
            ({ event, plenary } = await createAgoraWithPlenary());
            delegate = await generator.createApplication({
                first_name: 'Delegate',
                last_name: 'Example',
                body_name: 'Example body',
                participant_type: 'delegate',
                participant_order: 2
            }, event);
        });

        test('lets a holder of global:mark_attendance:agora alone mark a delegate, and answers with the attendance and a few fields of the application', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:mark_attendance:agora'] } });

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ plenary_id: plenary.id, application_id: delegate.id, ends: null });
            // Nothing else of the application: no user id, no email, no answers, no board comment.
            expect(res.body.data.application).toEqual({
                id: delegate.id,
                statutory_id: delegate.statutory_id,
                first_name: 'Delegate',
                last_name: 'Example',
                participant_type: 'delegate',
                participant_order: 2,
                body_id: delegate.body_id,
                body_name: 'Example body'
            });

            const attendances = await Attendance.findAll();
            expect(attendances.length).toEqual(1);
            expect(attendances[0].id).toEqual(res.body.data.id);
            expect(attendances[0].plenary_id).toEqual(plenary.id);
            expect(attendances[0].application_id).toEqual(delegate.id);
            expect(attendances[0].ends).toEqual(null);
        });

        test.each([
            ['the permission to manage plenaries', ['global:manage_plenaries:agora']],
            ['the permission to see plenaries', ['global:see_plenaries:agora']],
            ['the permissions named after another event type', ['global:mark_attendance:epm', 'global:mark_attendance:spm']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_incoming:agora']]
        ])('refuses %s and stores nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage plenaries.' });
            expect(await Attendance.count()).toEqual(0);
        });

        test('refuses a delegate who marks their own application, and stores nothing', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const own = await generator.createApplication({
                user_id: regularUser.id,
                status: 'accepted',
                confirmed: true,
                participant_type: 'delegate',
                participant_order: 1
            }, event);

            const res = await mark(event, plenary, own.id);

            expect(res.statusCode).toEqual(403);
            expect(await Attendance.count()).toEqual(0);
        });
    });

    describe('entering and leaving', () => {
        let event;
        let plenary;
        let delegate;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:mark_attendance:agora'] } });
            ({ event, plenary } = await createAgoraWithPlenary());
            delegate = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);
        });

        test('opens an attendance on the first mark, closes it on the second and opens a new one on the third', async () => {
            tk.freeze(new Date('2030-03-01T10:05:00.000Z'));
            const first = await mark(event, plenary, delegate.id);
            expect(first.statusCode).toEqual(200);
            expect(first.body.data).toMatchObject({ starts: '2030-03-01T10:05:00.000Z', ends: null });

            tk.freeze(new Date('2030-03-01T10:45:00.000Z'));
            const second = await mark(event, plenary, delegate.id);
            expect(second.statusCode).toEqual(200);
            expect(second.body.data).toMatchObject({
                id: first.body.data.id,
                starts: '2030-03-01T10:05:00.000Z',
                ends: '2030-03-01T10:45:00.000Z'
            });

            tk.freeze(new Date('2030-03-01T11:00:00.000Z'));
            const third = await mark(event, plenary, delegate.id);
            expect(third.statusCode).toEqual(200);
            expect(third.body.data).toMatchObject({ starts: '2030-03-01T11:00:00.000Z', ends: null });
            expect(third.body.data.id).not.toEqual(first.body.data.id);

            const attendances = await Attendance.findAll({ order: [['starts', 'ASC']], raw: true });
            expect(attendances.map((attendance) => [attendance.id, attendance.starts.toISOString(), attendance.ends && attendance.ends.toISOString()])).toEqual([
                [first.body.data.id, '2030-03-01T10:05:00.000Z', '2030-03-01T10:45:00.000Z'],
                [third.body.data.id, '2030-03-01T11:00:00.000Z', null]
            ]);
        });

        test('answers 422 when an attendance is closed in the millisecond it was opened, and leaves it open', async () => {
            tk.freeze(new Date('2030-03-01T10:05:00.000Z'));
            const first = await mark(event, plenary, delegate.id);
            expect(first.statusCode).toEqual(200);

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(422);
            // The message names an event: it was copied from the events.
            expect(res.body).toEqual({
                success: false,
                errors: { ends: ['Event cannot start after or at the same time it ends.'] }
            });
            expect((await Attendance.findByPk(first.body.data.id)).ends).toEqual(null);

            // A millisecond later it can be closed.
            tk.freeze(new Date('2030-03-01T10:05:00.001Z'));
            const later = await mark(event, plenary, delegate.id);
            expect(later.statusCode).toEqual(200);
            expect(later.body.data.ends).toEqual('2030-03-01T10:05:00.001Z');
        });

        test('keeps the attendances of two delegates apart', async () => {
            const otherDelegate = await generator.createApplication({ participant_type: 'delegate', participant_order: 2 }, event);

            tk.freeze(new Date('2030-03-01T10:05:00.000Z'));
            const mine = await mark(event, plenary, delegate.id);
            tk.freeze(new Date('2030-03-01T10:10:00.000Z'));
            const theirs = await mark(event, plenary, otherDelegate.id);

            expect(theirs.statusCode).toEqual(200);
            expect(theirs.body.data).toMatchObject({ application_id: otherDelegate.id, starts: '2030-03-01T10:10:00.000Z', ends: null });
            expect(theirs.body.data.id).not.toEqual(mine.body.data.id);
            // The first delegate is still in.
            expect((await Attendance.findByPk(mine.body.data.id)).ends).toEqual(null);
        });

        test('keeps the attendances of one delegate at two plenaries apart', async () => {
            const otherPlenary = await generator.createPlenary({
                starts: new Date('2030-03-01T10:30:00.000Z'),
                ends: new Date('2030-03-01T13:00:00.000Z')
            }, event);

            tk.freeze(new Date('2030-03-01T10:35:00.000Z'));
            const atFirst = await mark(event, plenary, delegate.id);
            tk.freeze(new Date('2030-03-01T10:40:00.000Z'));
            const atSecond = await mark(event, otherPlenary, delegate.id);

            expect(atSecond.statusCode).toEqual(200);
            expect(atSecond.body.data).toMatchObject({ plenary_id: otherPlenary.id, starts: '2030-03-01T10:40:00.000Z', ends: null });
            expect((await Attendance.findByPk(atFirst.body.data.id)).ends).toEqual(null);
        });
    });

    describe('which application is marked', () => {
        let event;
        let plenary;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:mark_attendance:agora'] } });
            ({ event, plenary } = await createAgoraWithPlenary());
        });

        test.each([
            ['its id as a number', (application) => application.id],
            ['its id as a string of digits', (application) => String(application.id)],
            ['its statutory id', (application) => application.statutory_id]
        ])('finds the application by %s', async (description, pick) => {
            const delegate = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);
            await generator.createApplication({ participant_type: 'delegate', participant_order: 2 }, event);

            const res = await mark(event, plenary, pick(delegate));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_id).toEqual(delegate.id);
            expect(await Attendance.count({ where: { application_id: delegate.id } })).toEqual(1);
            expect(await Attendance.count()).toEqual(1);
        });

        test.each(['delegate', 'envoy'])('lets an %s be marked', async (type) => {
            const application = await generator.createApplication({ participant_type: type, participant_order: 1 }, event);

            const res = await mark(event, plenary, application.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application.participant_type).toEqual(type);
            expect(await Attendance.count()).toEqual(1);
        });

        test.each([
            ['an observer', 'observer', 1],
            ['a visitor', 'visitor', 1],
            ['an applicant without a participant type', null, null]
        ])('refuses %s and stores nothing', async (description, type, order) => {
            const application = await generator.createApplication({ participant_type: type, participant_order: order }, event);

            const res = await mark(event, plenary, application.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'The applicant is not a delegate or envoy.' });
            expect(await Attendance.count()).toEqual(0);
        });

        test.each([
            ['id', (application) => application.id],
            ['statutory id', (application) => application.statutory_id]
        ])('answers 404 for the %s of a delegate of another event, and stores nothing', async (description, pick) => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            const delegate = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, otherEvent);

            const res = await mark(event, plenary, pick(delegate));

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'The application is not found.' });
            expect(await Attendance.count()).toEqual(0);
        });

        test.each([
            [2147483647], [2147483648], [-1], [1.5], [''], ['abc'], [null], [true], [[]], [{}]
        ])('answers 404 for the application id %j, and stores nothing', async (applicationId) => {
            await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

            const res = await mark(event, plenary, applicationId);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'The application is not found.' });
            expect(await Attendance.count()).toEqual(0);
        });

        // BUG: only the participant type is looked at. A delegate whose application is rejected
        // and cancelled is marked as attending. Expected: 403, as for somebody who is no delegate.
        test('lets a delegate whose application is rejected and cancelled be marked', async () => {
            const application = await generator.createApplication({
                participant_type: 'delegate',
                participant_order: 1,
                status: 'rejected',
                cancelled: true
            }, event);

            const res = await mark(event, plenary, application.id);

            expect(res.statusCode).toEqual(200);
            expect(await Attendance.count({ where: { application_id: application.id } })).toEqual(1);
        });
    });

    // Attendance can be marked until the plenary ends, the moment of the end included. Whoever
    // is still in at that moment is marked as leaving by the scheduled job (see cron-test).
    describe('until the plenary ends', () => {
        let event;
        let plenary;
        let delegate;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:mark_attendance:agora'] } });
            ({ event, plenary } = await createAgoraWithPlenary());
            delegate = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);
        });

        test.each([
            ['an hour before the plenary starts', '2030-03-01T09:00:00.000Z'],
            ['1 ms before the plenary ends', '2030-03-01T11:59:59.999Z'],
            ['at the moment the plenary ends (the end is inclusive)', ENDS]
        ])('lets a delegate be marked %s', async (description, now) => {
            tk.freeze(new Date(now));

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ starts: now, ends: null });
            expect(await Attendance.count()).toEqual(1);
        });

        test('refuses a mark 1 ms after the plenary ends, and stores nothing', async () => {
            tk.freeze(new Date('2030-03-01T12:00:00.001Z'));

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'The plenary is over already, cannot mark any more members.' });
            expect(await Attendance.count()).toEqual(0);
        });

        test('lets a delegate leave at the moment the plenary ends', async () => {
            const attendance = await generator.createAttendance({
                application_id: delegate.id,
                starts: new Date('2030-03-01T10:05:00.000Z'),
                ends: null
            }, plenary);
            tk.freeze(new Date(ENDS));

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: attendance.id, ends: ENDS });
        });

        test('refuses a delegate leaving 1 ms after the plenary ends, and leaves the attendance open', async () => {
            const attendance = await generator.createAttendance({
                application_id: delegate.id,
                starts: new Date('2030-03-01T10:05:00.000Z'),
                ends: null
            }, plenary);
            tk.freeze(new Date('2030-03-01T12:00:00.001Z'));

            const res = await mark(event, plenary, delegate.id);

            expect(res.statusCode).toEqual(403);
            expect((await Attendance.findByPk(attendance.id)).ends).toEqual(null);
        });
    });
});
