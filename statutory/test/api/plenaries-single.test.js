const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Plenaries displaying', () => {
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

    // The plenaries are for the Agora only: the type of the event is checked before anything else.
    test.each(['epm', 'spm'])('answers 400 for an %s event', async (type) => {
        const event = await generator.createEvent({ type, applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.message).toContain('Agora');
    });

    test('should fail if no permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary is not found', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary_id is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/NaN',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should list all of the plenaries for this event', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.id).toEqual(plenary.id);
    });

    test('should sort attendances', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const firstApplication = await generator.createApplication({ user_id: 1 }, event);
        const secondApplication = await generator.createApplication({ user_id: 2 }, event);
        const plenary = await generator.createPlenary({}, event);

        const firstAttendance = await generator.createAttendance({ starts: moment().add(1, 'day').toDate(), application_id: firstApplication.id }, plenary);
        const secondAttendance = await generator.createAttendance({ starts: moment().add(2, 'day').toDate(), application_id: firstApplication.id }, plenary);
        const fourthAttendance = await generator.createAttendance({ starts: moment().add(4, 'day').toDate(), application_id: secondApplication.id }, plenary);
        const thirdAttendance = await generator.createAttendance({ starts: moment().add(3, 'day').toDate(), application_id: secondApplication.id }, plenary);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.id).toEqual(plenary.id);
        expect(res.body.data.attendances.length).toEqual(4);
        expect(res.body.data.attendances[0].id).toEqual(fourthAttendance.id);
        expect(res.body.data.attendances[1].id).toEqual(thirdAttendance.id);
        expect(res.body.data.attendances[2].id).toEqual(secondAttendance.id);
        expect(res.body.data.attendances[3].id).toEqual(firstAttendance.id);
    });

    describe('who may see a plenary', () => {
        let event;
        let plenary;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
            plenary = await generator.createPlenary({
                name: 'Opening plenary',
                starts: new Date('2030-03-01T10:00:00.000Z'),
                ends: new Date('2030-03-01T12:00:00.000Z')
            }, event);
        });

        const show = (plenaryId = plenary.id) => request({
            path: '/events/' + event.id + '/plenaries/' + plenaryId,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each([
            'global:see_plenaries:agora',
            'global:manage_plenaries:agora'
        ])('lets a holder of %s alone see it, with an empty list while nobody attended', async (permission) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const res = await show();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: plenary.id,
                event_id: event.id,
                name: 'Opening plenary',
                starts: '2030-03-01T10:00:00.000Z',
                ends: '2030-03-01T12:00:00.000Z',
                duration: 7200,
                attendances: []
            });
        });

        test.each([
            ['the permission to mark attendance', ['global:mark_attendance:agora']],
            ['the permissions named after another event type', ['global:see_plenaries:epm', 'global:manage_plenaries:epm', 'global:see_plenaries:spm']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_candidates:agora']]
        ])('refuses %s', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await show();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot see this plenary.' });
        });

        test('refuses a delegate who attended the plenary', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await generator.createApplication({
                user_id: regularUser.id,
                status: 'accepted',
                confirmed: true,
                participant_type: 'delegate',
                participant_order: 1
            }, event);
            await generator.createAttendance({
                application_id: application.id,
                starts: new Date('2030-03-01T10:00:00.000Z'),
                ends: new Date('2030-03-01T11:00:00.000Z')
            }, plenary);

            const res = await show();

            expect(res.statusCode).toEqual(403);
        });

        // Unlike the other routes with a plenary in the path, this one checks the permission first.
        test.each(['NaN', '2147483647'])('answers 403 before it looks at the plenary id %s', async (plenaryId) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await show(plenaryId);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('the attendances of a plenary', () => {
        test('gives the attendances of this plenary only, each with a few fields of the application', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:see_plenaries:agora'] } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: new Date('2030-03-01T10:00:00.000Z'),
                ends: new Date('2030-03-01T12:00:00.000Z')
            }, event);
            const otherPlenary = await generator.createPlenary({
                starts: new Date('2030-03-02T10:00:00.000Z'),
                ends: new Date('2030-03-02T12:00:00.000Z')
            }, event);
            const delegate = await generator.createApplication({
                first_name: 'Delegate',
                last_name: 'Example',
                body_name: 'Example body',
                participant_type: 'delegate',
                participant_order: 2
            }, event);

            const closed = await generator.createAttendance({
                application_id: delegate.id,
                starts: new Date('2030-03-01T10:05:00.000Z'),
                ends: new Date('2030-03-01T10:45:00.000Z')
            }, plenary);
            const open = await generator.createAttendance({
                application_id: delegate.id,
                starts: new Date('2030-03-01T11:00:00.000Z'),
                ends: null
            }, plenary);
            await generator.createAttendance({
                application_id: delegate.id,
                starts: new Date('2030-03-02T10:00:00.000Z'),
                ends: new Date('2030-03-02T11:00:00.000Z')
            }, otherPlenary);

            const res = await request({
                path: '/events/' + event.id + '/plenaries/' + plenary.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            // The latest first.
            expect(res.body.data.attendances.map((attendance) => attendance.id)).toEqual([open.id, closed.id]);
            expect(res.body.data.attendances[0]).toMatchObject({
                plenary_id: plenary.id,
                application_id: delegate.id,
                starts: '2030-03-01T11:00:00.000Z',
                ends: null
            });
            expect(res.body.data.attendances[1]).toMatchObject({
                plenary_id: plenary.id,
                application_id: delegate.id,
                starts: '2030-03-01T10:05:00.000Z',
                ends: '2030-03-01T10:45:00.000Z'
            });
            // Nothing else of the application: no user id, no email, no answers, no board comment.
            expect(res.body.data.attendances[0].application).toEqual({
                id: delegate.id,
                statutory_id: delegate.statutory_id,
                first_name: 'Delegate',
                last_name: 'Example',
                participant_type: 'delegate',
                participant_order: 2,
                body_id: delegate.body_id,
                body_name: 'Example body'
            });
        });
    });
});
