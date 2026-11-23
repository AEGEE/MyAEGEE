const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Event, Position, Plenary } = require('../../models');

// A list or an object where one value belongs, nothing where a name belongs, an edit that
// puts a start after its end, an event type that does not exist: all are refused with a
// 4xx answer that names the field.
describe('Values of the wrong kind', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (method, path, body, query) => request({
        path,
        method,
        query,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const expectInvalid = (res, field) => {
        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty(field);
    };

    describe('a list or an object where one value belongs', () => {
        test.each([
            ['type', ['agora']],
            ['fee', [5]],
            ['fee', { amount: 5 }],
            ['vegetarian', [true]],
            ['vegetarian', 'yes']
        ])('should refuse a new event whose %s is %j', async (field, value) => {
            const res = await send('POST', '/', { ...generator.generateEvent({ type: 'agora' }), [field]: value });

            expectInvalid(res, field);
            expect(await Event.count()).toEqual(1);
        });

        test.each([
            ['fee', [5]],
            ['vegetarian', 'yes'],
            ['vegetarian', [true]]
        ])('should refuse changing %s of an event to %j', async (field, value) => {
            const res = await send('PUT', '/events/' + event.id, { [field]: value });

            expectInvalid(res, field);
        });

        test.each([[['published']], [{ value: 'published' }]])('should refuse %j as the status of an event', async (status) => {
            await event.update({ status: 'draft' });

            const res = await send('PUT', '/events/' + event.id + '/status', { status });

            expectInvalid(res, 'status');
            expect((await Event.findByPk(event.id)).status).toEqual('draft');
        });

        test.each([[['closed']], [{ value: 'closed' }]])('should refuse %j as the status of a position', async (status) => {
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id + '/status', { status });

            expectInvalid(res, 'status');
            expect((await Position.findByPk(position.id)).status).toEqual('open');
        });

        test.each([[['closed']], [{ value: 'closed' }]])('should refuse %j as the status of a question line', async (status) => {
            const questionLine = await generator.createQuestionLine({}, event);

            const res = await send('PUT', '/events/' + event.id + '/question-lines/' + questionLine.id + '/status', { status });

            expectInvalid(res, 'status');
        });

        test.each([[['approved']], [{ value: 'approved' }]])('should refuse %j as the status of a candidature', async (status) => {
            const position = await generator.createPosition({}, event);
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/status', { status });

            expectInvalid(res, 'status');
        });

        test('should refuse a list as a participants limit', async () => {
            const res = await send('POST', '/limits/agora', [{ body_id: 34, delegate: 1 }]);

            expectInvalid(res, 'body_id');
        });
    });

    describe('a plenary without a name', () => {
        test('should refuse a new plenary whose name is null', async () => {
            const res = await send('POST', '/events/' + event.id + '/plenaries', { ...generator.generatePlenary(), name: null });

            expectInvalid(res, 'name');
            expect(await Plenary.count()).toEqual(0);
        });

        test('should refuse changing the name of a plenary to null', async () => {
            const plenary = await generator.createPlenary({ name: 'Opening plenary' }, event);

            const res = await send('PUT', '/events/' + event.id + '/plenaries/' + plenary.id, { name: null });

            expectInvalid(res, 'name');
            expect((await Plenary.findByPk(plenary.id)).name).toEqual('Opening plenary');
        });
    });

    // An edit that sends one date is checked against the dates that are stored.
    describe('a start after its end', () => {
        test('should refuse moving the start of a plenary past its end', async () => {
            const plenary = await generator.createPlenary({
                starts: new Date('2031-07-01T10:00:00.000Z'),
                ends: new Date('2031-07-01T12:00:00.000Z')
            }, event);

            const res = await send('PUT', '/events/' + event.id + '/plenaries/' + plenary.id, { starts: '2031-07-01T13:00:00.000Z' });

            expectInvalid(res, 'ends');
            expect((await Plenary.findByPk(plenary.id)).starts).toEqual(plenary.starts);
        });

        test('should accept moving the start of a plenary to before its end', async () => {
            const plenary = await generator.createPlenary({
                starts: new Date('2031-07-01T10:00:00.000Z'),
                ends: new Date('2031-07-01T12:00:00.000Z')
            }, event);

            const res = await send('PUT', '/events/' + event.id + '/plenaries/' + plenary.id, { starts: '2031-07-01T11:00:00.000Z' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.starts).toEqual('2031-07-01T11:00:00.000Z');
        });

        test('should refuse moving the start of the applications for a position past their end', async () => {
            const position = await generator.createPosition({
                starts: new Date('2031-07-01T10:00:00.000Z'),
                ends: new Date('2031-07-02T10:00:00.000Z')
            }, event);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id, { starts: '2031-07-03T10:00:00.000Z' });

            expectInvalid(res, 'ends');
            expect((await Position.findByPk(position.id)).starts).toEqual(position.starts);
        });

        test.each([
            ['the start of an event past its end', (e) => ({ starts: moment(e.ends).add(1, 'day').toISOString() }), 'ends'],
            ['the end of an event to before its start', (e) => ({ ends: moment(e.starts).subtract(1, 'day').toISOString() }), 'ends'],
            ['the start of the applications past their end', (e) => ({ application_period_starts: moment(e.application_period_ends).add(1, 'day').toISOString() }), 'application_period_ends'],
            ['the end of the applications past the start of the event', (e) => ({ application_period_ends: moment(e.starts).add(1, 'day').toISOString() }), 'application_period_ends'],
            ['the start of an event to before the end of the applications', (e) => ({ starts: moment(e.application_period_ends).subtract(1, 'hour').toISOString() }), 'application_period_ends']
        ])('should refuse moving %s', async (description, change, field) => {
            const res = await send('PUT', '/events/' + event.id, change(event));

            expectInvalid(res, field);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.starts).toEqual(event.starts);
            expect(eventFromDb.ends).toEqual(event.ends);
        });

        test('should accept an edit of an event that sends no date', async () => {
            const res = await send('PUT', '/events/' + event.id, { name: 'Another name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.name).toEqual('Another name');
        });
    });

    describe('filters of the event list', () => {
        test.each([
            [{ type: 'conference' }],
            [{ type: ['agora', 'conference'] }],
            [{ type: { name: 'agora' } }]
        ])('should answer 400 for the event types in %j', async (query) => {
            const res = await send('GET', '/', undefined, query);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'The event type should be one of these: agora, epm, spm.' });
        });

        test.each([
            ['/', { starts: '06-05-2031' }, 'starts'],
            ['/', { ends: '2031/06/05' }, 'ends'],
            ['/', { starts: '2031-6-5' }, 'starts'],
            ['/', { starts: '2031-02-30' }, 'starts'],
            ['/recents', { ends: '06-05-2031' }, 'ends']
        ])('should answer 400 on %s for the date in %j', async (path, query, field) => {
            const res = await send('GET', path, undefined, query);

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual(`The "${field}" date is invalid, it should be in the YYYY-MM-DD format.`);
        });

        test('should still list the events of the given types from the given day on', async () => {
            const res = await send('GET', '/', undefined, { type: ['agora', 'epm'], starts: '2001-01-01' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });
    });
});
