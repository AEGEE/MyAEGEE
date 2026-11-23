const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Plenary } = require('../../models');

describe('Plenaries creation', () => {
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

    test('should fail if starts is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({ starts: null });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('starts');
    });

    test('should fail if ends is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({ ends: null });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if start is earlier than ends', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().subtract(1, 'week')
        });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({});

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = generator.generatePlenary({});

        const res = await request({
            path: '/events/' + event.id + '/plenaries/',
            method: 'POST',
            body: plenary,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    // The plenaries are for the Agora only: the type of the event is checked before anything else.
    test.each(['epm', 'spm'])('answers 400 for an %s event and stores nothing', async (type) => {
        const event = await generator.createEvent({ type, applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/plenaries',
            method: 'POST',
            body: generator.generatePlenary({}),
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.message).toContain('Agora');
        expect(await Plenary.count()).toEqual(0);
    });

    describe('who may add a plenary', () => {
        const body = {
            name: 'Opening plenary',
            starts: '2030-03-01T10:00:00.000Z',
            ends: '2030-03-01T12:00:00.000Z'
        };
        let event;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const create = () => request({
            path: '/events/' + event.id + '/plenaries',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('lets a holder of global:manage_plenaries:agora alone add one, and answers with its duration in seconds', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_plenaries:agora'] } });

            const res = await create();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ ...body, event_id: event.id, duration: 7200 });

            const plenaries = await Plenary.findAll();
            expect(plenaries.length).toEqual(1);
            expect(plenaries[0].id).toEqual(res.body.data.id);
            expect(plenaries[0].event_id).toEqual(event.id);
            expect(plenaries[0].name).toEqual('Opening plenary');
            expect(plenaries[0].starts.toISOString()).toEqual(body.starts);
            expect(plenaries[0].ends.toISOString()).toEqual(body.ends);
        });

        test.each([
            ['the permission to see plenaries', ['global:see_plenaries:agora']],
            ['the permission to mark attendance', ['global:mark_attendance:agora']],
            ['the permissions named after another event type', ['global:manage_plenaries:epm', 'global:manage_plenaries:spm']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_candidates:agora']]
        ])('refuses %s and stores nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await create();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage plenaries.' });
            expect(await Plenary.count()).toEqual(0);
        });
    });

    describe('what is stored', () => {
        let event;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_plenaries:agora'] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const create = (body) => request({
            path: '/events/' + event.id + '/plenaries',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('adds the plenary to the Agora in the URL, whatever event the body names', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await create({
                name: 'Opening plenary',
                starts: '2030-03-01T10:00:00.000Z',
                ends: '2030-03-01T12:00:00.000Z',
                event_id: otherEvent.id
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.event_id).toEqual(event.id);
            expect((await Plenary.findByPk(res.body.data.id)).event_id).toEqual(event.id);
        });

        test.each([
            ['an empty name', { name: '' }],
            ['a name of spaces only', { name: '   ' }],
            ['no name at all', {}]
        ])('answers 422 for %s and stores nothing', async (description, name) => {
            const res = await create({ starts: '2030-03-01T10:00:00.000Z', ends: '2030-03-01T12:00:00.000Z', ...name });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { name: ['Plenary name should be set.'] } });
            expect(await Plenary.count()).toEqual(0);
        });

        // BUG: the model lets a name of null through (its validation skips null) and the
        // column does not, so the message of the database comes back. Expected: 422, as for an empty name.
        test('answers 500 for a name that is null', async () => {
            const res = await create({ name: null, starts: '2030-03-01T10:00:00.000Z', ends: '2030-03-01T12:00:00.000Z' });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toContain('violates not-null constraint');
            expect(await Plenary.count()).toEqual(0);
        });

        describe('the end is after the start', () => {
            const STARTS = '2030-03-01T10:00:00.000Z';

            test('accepts an end 1 ms after the start', async () => {
                const res = await create({ name: 'Shortest plenary', starts: STARTS, ends: '2030-03-01T10:00:00.001Z' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.data.duration).toEqual(0.001);
                expect(await Plenary.count()).toEqual(1);
            });

            test.each([
                ['at the moment of the start (the start is not a valid end)', STARTS],
                ['1 ms before the start', '2030-03-01T09:59:59.999Z'],
                ['a day before the start', '2030-02-28T10:00:00.000Z']
            ])('answers 422 for an end %s and stores nothing', async (description, ends) => {
                const res = await create({ name: 'Opening plenary', starts: STARTS, ends });

                expect(res.statusCode).toEqual(422);
                expect(res.body).toEqual({
                    success: false,
                    errors: { ends: ['Plenary cannot start after or at the same time it ends.'] }
                });
                expect(await Plenary.count()).toEqual(0);
            });
        });

        test('accepts a plenary that is over already', async () => {
            const res = await create({ name: 'Yesterday', starts: '2020-03-01T10:00:00.000Z', ends: '2020-03-01T12:00:00.000Z' });

            expect(res.statusCode).toEqual(200);
            expect(await Plenary.count()).toEqual(1);
        });

        // BUG: the whole body goes to the model, so the client chooses the id and the creation
        // time, which the list is sorted by. Expected: both are ignored.
        test('takes the id and the creation time from the body', async () => {
            const res = await create({
                name: 'Opening plenary',
                starts: '2030-03-01T10:00:00.000Z',
                ends: '2030-03-01T12:00:00.000Z',
                id: 4242,
                created_at: '2001-01-01T00:00:00.000Z'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(4242);
            expect((await Plenary.findByPk(4242)).created_at.toISOString()).toEqual('2001-01-01T00:00:00.000Z');
        });
    });
});
