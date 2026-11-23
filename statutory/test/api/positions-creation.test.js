const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position } = require('../../models');

describe('Positions creation', () => {
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

    test('should fail if deadline is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ ends: null });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if positions amount is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ places: 'string' });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('places');
    });

    test('should fail if positions amount is less than 1', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ places: -1 });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('places');
    });

    test('should fail if name is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({ name: null });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if start is earlier than ends', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().subtract(1, 'week')
        });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
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
        const position = generator.generatePosition({});

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({});

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(position.name);
        expect(res.body.data.description).toEqual(position.description);
        expect(res.body.data.places).toEqual(position.places);
        expect(res.body.data.status).toEqual('open');
    });

    test('should plan candidature opening for the future', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
        });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(position.name);
        expect(res.body.data.description).toEqual(position.description);
        expect(res.body.data.places).toEqual(position.places);
        expect(res.body.data.status).toEqual('closed');
    });

    test('should open candidates if the application period is opened already', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = generator.generatePosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
        });

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'POST',
            body: position,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(position.name);
        expect(res.body.data.description).toEqual(position.description);
        expect(res.body.data.places).toEqual(position.places);
        expect(res.body.data.status).toEqual('open');
    });

    describe('who may add a position and what it takes', () => {
        const MANAGE = 'global:manage_candidates:agora';
        let event;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        afterEach(() => {
            tk.reset();
        });

        const create = (body, targetEvent = event) => request({
            path: '/events/' + targetEvent.id + '/positions/',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // A position that is open for candidatures now.
        const openPosition = (options = {}) => generator.generatePosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            ...options
        });

        test('lets a holder of global:manage_candidates:agora alone add a position to the Agora in the URL', async () => {
            const res = await create(openPosition({ name: 'President', places: 2, start_term: '2031-08-01', end_term: 'one year' }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                event_id: event.id,
                name: 'President',
                places: 2,
                start_term: '2031-08-01',
                end_term: 'one year',
                status: 'open',
                deleted: false
            });

            const positions = await Position.findAll({ where: {} });
            expect(positions.map((position) => [position.id, position.event_id, position.name]))
                .toEqual([[res.body.data.id, event.id, 'President']]);
        });

        test('refuses the permission for another event type and the other permissions for an Agora', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:manage_candidates:epm',
                        'global:manage_event:agora',
                        'global:manage_applications:agora',
                        'global:manage_plenaries:agora',
                        'global:manage_question_lines:agora'
                    ]
                }
            });

            const res = await create(openPosition());

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage positions.' });
            expect(await Position.count()).toEqual(0);
        });

        test('ignores the status in the body: the position is open because its period runs', async () => {
            const res = await create({ ...openPosition(), status: 'closed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('open');
        });

        test.each([
            ['no start of the term', { start_term: undefined }, 'start_term'],
            ['an empty start of the term', { start_term: '' }, 'start_term'],
            ['a start of the term that is not a date', { start_term: '2031-13-45' }, 'start_term'],
            ['no end of the term', { end_term: undefined }, 'end_term'],
            ['an empty end of the term', { end_term: '' }, 'end_term'],
            ['no start of the period', { starts: undefined }, 'starts'],
            ['a start of the period that is not a date', { starts: '2031-13-45T10:00:00.000Z' }, 'starts'],
            ['an end of the period that is not a date', { ends: '2031-13-45T10:00:00.000Z' }, 'ends'],
            ['an empty name', { name: '' }, 'name'],
            ['a name of spaces only', { name: '   ' }, 'name'],
            ['no places', { places: undefined }, 'places'],
            ['0 places', { places: 0 }, 'places']
        ])('answers 422 for %s and stores nothing', async (description, change, field) => {
            const res = await create({ ...openPosition(), ...change });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect(await Position.count()).toEqual(0);
        });

        test('answers 422 for a period that ends at the moment it starts', async () => {
            const starts = moment().subtract(1, 'week').toDate();

            const res = await create(openPosition({ starts, ends: starts }));

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { ends: ['Position cannot start after or at the same time it ends.'] }
            });
            expect(await Position.count()).toEqual(0);
        });

        test('accepts a period that ends 1 ms after it starts', async () => {
            const starts = moment().subtract(1, 'week').toDate();

            const res = await create(openPosition({ starts, ends: new Date(starts.getTime() + 1) }));

            expect(res.statusCode).toEqual(200);
            expect(await Position.count()).toEqual(1);
        });

        // BUG: these values pass the model validation and are refused by the database, so the answer
        // is 500 with the database's message. Expected: 422 with errors.places or errors.body_id.
        test.each([
            ['a number of places with a fraction', { places: 1.5 }],
            ['a body id that is not a number', { body_id: 'abc' }]
        ])('answers 500 for %s and stores nothing', async (description, change) => {
            const res = await create({ ...openPosition(), ...change });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(await Position.count()).toEqual(0);
        });

        // BUG: the body is stored as it comes, so `deleted: true` adds a position that is deleted
        // from the start and that no list shows. Expected: `deleted` is ignored, like `status`.
        test('adds a position that is already deleted when the body says so', async () => {
            const res = await create({ ...openPosition(), deleted: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.deleted).toEqual(true);

            const list = await request({
                path: '/events/' + event.id + '/positions/',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });
            expect(list.body.data).toEqual([]);
        });

        describe('at the edges of its period', () => {
            const STARTS = new Date('2031-06-01T10:00:00.000Z');
            const ENDS = new Date('2031-06-15T10:00:00.000Z');

            test.each([
                ['closed 1 ms before its period starts', new Date(STARTS.getTime() - 1), 'closed'],
                ['open exactly when its period starts (inclusive)', STARTS, 'open'],
                ['open exactly when its period ends (inclusive)', ENDS, 'open'],
                ['closed 1 ms after its period ends', new Date(ENDS.getTime() + 1), 'closed']
            ])('a position added %s', async (description, now, status) => {
                tk.freeze(now);
                const res = await create(generator.generatePosition({ starts: STARTS, ends: ENDS, start_term: '2031-08-01' }));

                expect(res.statusCode).toEqual(200);
                expect(res.body.data.status).toEqual(status);
                expect(res.body.data.can_apply).toEqual(status === 'open');
            });
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and stores nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });

            const res = await create(openPosition(), otherEvent);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect(await Position.count()).toEqual(0);
        });
    });
});
