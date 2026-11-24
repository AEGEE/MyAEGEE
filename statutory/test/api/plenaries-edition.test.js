const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Plenary } = require('../../models');

describe('Plenaries edition', () => {
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

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if plenary is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/1337',
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if plenary ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/NaN',
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.name).toEqual('test');
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { starts: null },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('starts');
    });

    // The plenaries are for the Agora only: the type of the event is checked before anything else.
    test.each(['epm', 'spm'])('answers 400 for an %s event and changes nothing', async (type) => {
        const event = await generator.createEvent({ type, applications: [] });
        const plenary = await generator.createPlenary({ name: 'Old name' }, event);

        const res = await request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body: { name: 'New name' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.message).toContain('Agora');
        expect((await Plenary.findByPk(plenary.id)).name).toEqual('Old name');
    });

    describe('who may edit a plenary', () => {
        let event;
        let plenary;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
            plenary = await generator.createPlenary({
                name: 'Old name',
                starts: new Date('2030-03-01T10:00:00.000Z'),
                ends: new Date('2030-03-01T12:00:00.000Z')
            }, event);
        });

        const edit = (body) => request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('lets a holder of global:manage_plenaries:agora alone change the name and both times', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_plenaries:agora'] } });

            const res = await edit({ name: 'New name', starts: '2030-03-02T14:00:00.000Z', ends: '2030-03-02T15:30:00.000Z' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: plenary.id,
                event_id: event.id,
                name: 'New name',
                starts: '2030-03-02T14:00:00.000Z',
                ends: '2030-03-02T15:30:00.000Z',
                duration: 5400
            });

            const plenaryFromDb = await Plenary.findByPk(plenary.id);
            expect(plenaryFromDb.name).toEqual('New name');
            expect(plenaryFromDb.starts.toISOString()).toEqual('2030-03-02T14:00:00.000Z');
            expect(plenaryFromDb.ends.toISOString()).toEqual('2030-03-02T15:30:00.000Z');
        });

        test.each([
            ['the permission to see plenaries', ['global:see_plenaries:agora']],
            ['the permission to mark attendance', ['global:mark_attendance:agora']],
            ['the permissions named after another event type', ['global:manage_plenaries:epm', 'global:manage_plenaries:spm']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_candidates:agora']]
        ])('refuses %s and changes nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await edit({ name: 'New name' });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage plenaries.' });
            expect((await Plenary.findByPk(plenary.id)).name).toEqual('Old name');
        });
    });

    describe('what can be changed', () => {
        const STARTS = '2030-03-01T10:00:00.000Z';
        const ENDS = '2030-03-01T12:00:00.000Z';
        let event;
        let plenary;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_plenaries:agora'] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            plenary = await generator.createPlenary({
                name: 'Old name',
                starts: new Date(STARTS),
                ends: new Date(ENDS),
                created_at: new Date('2030-01-01T12:00:00.000Z')
            }, event);
        });

        const edit = (body) => request({
            path: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('ignores the id and the creation time in the body', async () => {
            const res = await edit({ name: 'New name', id: 4242, created_at: '2001-01-01T00:00:00.000Z' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: plenary.id, name: 'New name', created_at: '2030-01-01T12:00:00.000Z' });
            expect(await Plenary.count()).toEqual(1);
            expect((await Plenary.findByPk(plenary.id)).created_at.toISOString()).toEqual('2030-01-01T12:00:00.000Z');
        });

        test.each([
            ['an empty name', ''],
            ['a name of spaces only', '   ']
        ])('answers 422 for %s and changes nothing', async (description, name) => {
            const res = await edit({ name });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { name: ['Plenary name should be set.'] } });
            expect((await Plenary.findByPk(plenary.id)).name).toEqual('Old name');
        });

        test('accepts a new end 1 ms after the start', async () => {
            const res = await edit({ ends: '2030-03-01T10:00:00.001Z' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.duration).toEqual(0.001);
        });

        test.each([
            ['at the moment of the start (the start is not a valid end)', STARTS],
            ['1 ms before the start', '2030-03-01T09:59:59.999Z']
        ])('answers 422 for a new end %s and changes nothing', async (description, ends) => {
            const res = await edit({ ends });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { ends: ['Plenary cannot start after or at the same time it ends.'] }
            });
            expect((await Plenary.findByPk(plenary.id)).ends.toISOString()).toEqual(ENDS);
        });

        test('answers 422 when both times are sent and the end is before the start', async () => {
            const res = await edit({ starts: '2030-03-01T13:00:00.000Z', ends: '2030-03-01T12:30:00.000Z' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('ends');

            const plenaryFromDb = await Plenary.findByPk(plenary.id);
            expect(plenaryFromDb.starts.toISOString()).toEqual(STARTS);
            expect(plenaryFromDb.ends.toISOString()).toEqual(ENDS);
        });
    });
});
