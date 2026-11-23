const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Plenaries listing', () => {
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
        await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
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
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should list all of the plenaries for this event', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPlenary = await generator.createPlenary({}, firstEvent);

        const secondEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPlenary({}, secondEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/plenaries/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstPlenary.id);
    });

    test('should list the plenaries in the order they were created, not in the order they take place', async () => {
        // Explicit creation times, a minute apart and against the order of the ids:
        // the route sorts by creation time, and rows made right after each other can share a millisecond.
        const at = (minute) => new Date(Date.UTC(2030, 0, 1, 12, minute));

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const secondPlenary = await generator.createPlenary({
            created_at: at(2),
            starts: new Date('2030-03-01T10:00:00.000Z'),
            ends: new Date('2030-03-01T12:00:00.000Z')
        }, event);
        const firstPlenary = await generator.createPlenary({
            created_at: at(1),
            starts: new Date('2030-03-03T10:00:00.000Z'),
            ends: new Date('2030-03-03T12:00:00.000Z')
        }, event);
        const thirdPlenary = await generator.createPlenary({
            created_at: at(3),
            starts: new Date('2030-03-02T10:00:00.000Z'),
            ends: new Date('2030-03-02T12:00:00.000Z')
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.map((plenary) => plenary.id)).toEqual([firstPlenary.id, secondPlenary.id, thirdPlenary.id]);
    });

    describe('who may see the plenaries', () => {
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

        const list = () => request({
            path: '/events/' + event.id + '/plenaries',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each([
            'global:see_plenaries:agora',
            'global:manage_plenaries:agora'
        ])('lets a holder of %s alone see them, each with its duration in seconds', async (permission) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const res = await list();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0]).toMatchObject({
                id: plenary.id,
                event_id: event.id,
                name: 'Opening plenary',
                starts: '2030-03-01T10:00:00.000Z',
                ends: '2030-03-01T12:00:00.000Z',
                duration: 7200
            });
            // The attendances come with a single plenary only.
            expect(res.body.data[0]).not.toHaveProperty('attendances');
        });

        test.each([
            ['the permission to mark attendance', ['global:mark_attendance:agora']],
            ['the permissions named after another event type', ['global:see_plenaries:epm', 'global:manage_plenaries:epm', 'global:see_plenaries:spm']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_candidates:agora']]
        ])('refuses %s', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await list();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage plenaries.' });
        });

        test('refuses a member with a confirmed application as a delegate', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await generator.createApplication({
                user_id: regularUser.id,
                status: 'accepted',
                confirmed: true,
                participant_type: 'delegate',
                participant_order: 1
            }, event);

            const res = await list();

            expect(res.statusCode).toEqual(403);
        });

        test('answers with an empty list for an Agora without plenaries', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:see_plenaries:agora'] } });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await request({
                path: '/events/' + otherEvent.id + '/plenaries',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, data: [] });
        });
    });
});
