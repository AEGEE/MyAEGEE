const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Event, Plenary, Position, Candidate } = require('../../models');

// A date has a year from 1 to 9999 and exists in the calendar, in a body and in a filter.
// A day of a candidature is written as YYYY-MM-DD. A field that holds a day keeps the day
// as it is written, whatever the time zone of a full timestamp.
describe('Dates', () => {
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

    const OUT_OF_RANGE = ['0000-01-01', '0000-01-01T10:00:00.000Z', '0001-01-01T00:30:00.000+02:00', '2031-02-30', '2031-13-01T10:00:00.000Z'];

    test.each(OUT_OF_RANGE)('an event that starts %s answers 422', async (starts) => {
        const res = await send('POST', '/', { ...generator.generateEvent({ type: 'epm' }), starts });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('starts');
        expect(await Event.count()).toEqual(1);
    });

    test.each(OUT_OF_RANGE)('a plenary that starts %s answers 422', async (starts) => {
        const res = await send('POST', '/events/' + event.id + '/plenaries', { ...generator.generatePlenary(), starts });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('starts');
        expect(await Plenary.count()).toEqual(0);
    });

    test.each(OUT_OF_RANGE)('a position whose term starts %s answers 422', async (startTerm) => {
        const position = await generator.createPosition({}, event);

        const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id, { start_term: startTerm });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('start_term');
    });

    test('a plenary in the year 1 is stored', async () => {
        const res = await send('POST', '/events/' + event.id + '/plenaries', generator.generatePlenary({
            starts: '0001-01-01T10:00:00.000Z',
            ends: '0001-01-01T12:00:00.000Z'
        }));

        expect(res.statusCode).toEqual(200);
        expect((await Plenary.findByPk(res.body.data.id)).starts.toISOString()).toEqual('0001-01-01T10:00:00.000Z');
    });

    test.each([
        ['/', 'starts'],
        ['/', 'ends'],
        ['/recents', 'ends']
    ])('the filter %s?%s answers 400 for a date out of range', async (path, filter) => {
        for (const value of [...OUT_OF_RANGE, '10000-01-01']) {
            const res = await send('GET', path, undefined, { [filter]: value });

            expect({ value, status: res.statusCode }).toEqual({ value, status: 400 });
        }
    });

    test.each(['0001-01-01', '9999-12-31'])('the event list takes the filter starts=%s', async (value) => {
        const res = await send('GET', '/', undefined, { starts: value });

        expect(res.statusCode).toEqual(200);
    });

    test.each([
        ['2032-01-01T00:30:00.000+02:00', '2032-01-01'],
        ['2031-12-31T23:30:00.000-02:00', '2031-12-31'],
        ['2032-01-01T00:00:00.000Z', '2032-01-01'],
        ['2032-01-01', '2032-01-01']
    ])('a position whose term starts %s keeps the day %s', async (startTerm, day) => {
        const position = await generator.createPosition({}, event);

        const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id, { start_term: startTerm });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.start_term).toEqual(day);
        expect((await Position.findByPk(position.id)).start_term).toEqual(day);
    });

    describe('the days of a candidature', () => {
        test.each([
            ['date_of_birth', '12abc'],
            ['date_of_birth', '275760-09-14'],
            ['date_of_birth', '0000-01-01'],
            ['date_of_birth', '1990-02-30'],
            ['date_of_birth', '17/05/1990'],
            ['member_since', '2019-5-1'],
            ['member_since', '2019-05-01T00:00:00.000Z']
        ])('%s %s answers 422', async (field, value) => {
            const position = await generator.createPosition({}, event);
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id, { [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors[field]).toEqual(['The value should be a date with a YYYY-MM-DD format.']);
            expect((await Candidate.findByPk(candidate.id))[field]).toEqual(candidate[field]);
        });

        test('a day written as YYYY-MM-DD is stored', async () => {
            const position = await generator.createPosition({}, event);
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id, {
                date_of_birth: '1990-05-17',
                member_since: '2019-05-01'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ date_of_birth: '1990-05-17', member_since: '2019-05-01' });
        });
    });
});
