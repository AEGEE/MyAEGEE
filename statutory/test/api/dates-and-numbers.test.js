const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// One above the largest whole number a column holds.
const TOO_BIG = 2147483648;

// A value that is not a date, or a number that does not fit its column, is refused with
// a validation error on the field.
describe('Dates and numbers that do not fit their column', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (method, path, body) => request({
        path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const expectInvalid = (res, field) => {
        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty(field);
    };

    describe('events', () => {
        const dates = [
            'starts',
            'ends',
            'application_period_starts',
            'application_period_ends',
            'board_approve_deadline',
            'participants_list_publish_deadline',
            'memberslist_submission_deadline',
            'draft_proposal_deadline',
            'final_proposal_deadline',
            'candidature_deadline',
            'booklet_publication_deadline',
            'updated_booklet_publication_deadline'
        ];

        test.each(dates)('should refuse a new event whose %s is not a date', async (field) => {
            const res = await send('POST', '/', { ...generator.generateEvent({ type: 'agora' }), [field]: 'not-a-date' });

            expectInvalid(res, field);
        });

        test.each(dates)('should refuse changing %s of an event to something that is not a date', async (field) => {
            const res = await send('PUT', '/events/' + event.id, { [field]: 'not-a-date' });

            expectInvalid(res, field);
        });

        test.each([
            ['body_id', TOO_BIG],
            ['body_id', -TOO_BIG - 1],
            ['body_id', 'abc'],
            ['fee', 'abc']
        ])('should refuse a new event whose %s is %p', async (field, value) => {
            const res = await send('POST', '/', { ...generator.generateEvent({ type: 'epm' }), [field]: value });

            expectInvalid(res, field);
        });

        test('should refuse changing the body of an event to a number that is too big', async () => {
            const res = await send('PUT', '/events/' + event.id, { body_id: TOO_BIG });

            expectInvalid(res, 'body_id');
        });
    });

    describe('positions', () => {
        test.each([
            ['starts', 'not-a-date'],
            ['ends', 'not-a-date'],
            ['start_term', 'not-a-date'],
            ['places', TOO_BIG],
            ['places', 'abc'],
            ['body_id', TOO_BIG],
            ['body_id', 'abc']
        ])('should refuse a position whose %s is %p', async (field, value) => {
            const res = await send('POST', '/events/' + event.id + '/positions', { ...generator.generatePosition(), [field]: value });

            expectInvalid(res, field);
        });

        test.each([
            ['starts', 'not-a-date'],
            ['start_term', 'not-a-date'],
            ['places', TOO_BIG]
        ])('should refuse changing %s of a position to %p', async (field, value) => {
            const position = await generator.createPosition({}, event);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id, { [field]: value });

            expectInvalid(res, field);
        });
    });

    describe('plenaries', () => {
        test.each(['starts', 'ends'])('should refuse a plenary whose %s is not a date', async (field) => {
            const res = await send('POST', '/events/' + event.id + '/plenaries', { ...generator.generatePlenary(), [field]: 'not-a-date' });

            expectInvalid(res, field);
        });

        test.each(['starts', 'ends'])('should refuse changing %s of a plenary to something that is not a date', async (field) => {
            const plenary = await generator.createPlenary({}, event);

            const res = await send('PUT', '/events/' + event.id + '/plenaries/' + plenary.id, { [field]: 'not-a-date' });

            expectInvalid(res, field);
        });
    });

    describe('applications', () => {
        test.each([TOO_BIG, 'abc', -1])('should refuse an application whose number of events visited is %p', async (value) => {
            const res = await send('POST', '/events/' + event.id + '/applications', generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                number_of_events_visited: value
            }, event));

            expectInvalid(res, 'number_of_events_visited');
        });

        test.each([TOO_BIG, 'abc'])('should refuse the participant order %p', async (value) => {
            const application = await generator.createApplication({
                user_id: 1337,
                body_id: regularUser.bodies[0].id,
                participant_type: null,
                participant_order: null
            }, event);

            const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id + '/board', {
                participant_type: 'visitor',
                participant_order: value
            });

            expectInvalid(res, 'participant_order');
        });

        test.each([
            ['limit', '99999999999999999999'],
            ['offset', '99999999999999999999']
        ])('should refuse a list with %s %s', async (key, value) => {
            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                query: { [key]: value },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual(`The "${key}" parameter should be a whole number, zero or higher.`);
        });
    });

    describe('participants limits', () => {
        test.each([
            ['body_id', TOO_BIG],
            ['delegate', TOO_BIG],
            ['envoy', TOO_BIG],
            ['observer', TOO_BIG],
            ['visitor', TOO_BIG]
        ])('should refuse a limit whose %s is too big', async (field, value) => {
            const res = await send('POST', '/limits/agora', { body_id: 34, delegate: 1, envoy: 1, observer: 1, visitor: 1, [field]: value });

            expectInvalid(res, field);
        });
    });

    describe('members lists', () => {
        test.each(['abc', -1])('should refuse the paid fee %p', async (value) => {
            await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

            const res = await send('PUT', '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid', { fee_paid: value });

            expectInvalid(res, 'fee_paid');
        });
    });

    // A date is written as a day (2031-07-01) or as a full timestamp (2031-07-01T10:00:00.000Z).
    describe('values that only look like a date', () => {
        const loose = ['1', 'tomorrow', '2031', '07/01/2031', '1 July 2031', 1900000000000, true, ['2031-07-01'], '2031-13-45', '2031-07-01T25:00:00.000Z'];

        test.each(loose)('should refuse %p as the start of a new event', async (value) => {
            const res = await send('POST', '/', { ...generator.generateEvent({ type: 'agora' }), starts: value });

            expectInvalid(res, 'starts');
        });

        test.each(loose)('should refuse changing the participants list deadline of an event to %p', async (value) => {
            const res = await send('PUT', '/events/' + event.id, { participants_list_publish_deadline: value });

            expectInvalid(res, 'participants_list_publish_deadline');
        });

        test.each(loose)('should refuse %p as the start of a position', async (value) => {
            const res = await send('POST', '/events/' + event.id + '/positions', { ...generator.generatePosition(), starts: value });

            expectInvalid(res, 'starts');
        });

        test.each(loose)('should refuse %p as the start of the term of a position', async (value) => {
            const res = await send('POST', '/events/' + event.id + '/positions', { ...generator.generatePosition(), start_term: value });

            expectInvalid(res, 'start_term');
        });

        test.each(loose)('should refuse %p as the end of a plenary', async (value) => {
            const res = await send('POST', '/events/' + event.id + '/plenaries', { ...generator.generatePlenary(), ends: value });

            expectInvalid(res, 'ends');
        });

        test.each([
            ['a day', '2031-07-01', '2031-07-01'],
            ['a timestamp in UTC', '2031-07-01T10:00:00.000Z', '2031-07-01T10:00:00.000Z'],
            ['a timestamp without milliseconds', '2031-07-01T10:00:00Z', '2031-07-01T10:00:00.000Z'],
            ['a timestamp with an offset', '2031-07-01T12:00:00+02:00', '2031-07-01T10:00:00.000Z']
        ])('should take %s as the end of a plenary', async (description, value, stored) => {
            const res = await send('POST', '/events/' + event.id + '/plenaries', {
                name: 'Opening plenary',
                starts: '2031-06-30T10:00:00.000Z',
                ends: value
            });

            expect(res.statusCode).toEqual(200);
            expect(new Date(res.body.data.ends).toISOString().startsWith(stored.slice(0, 10))).toEqual(true);
            if (stored.length > 10) {
                expect(res.body.data.ends).toEqual(stored);
            }
        });

        test.each(['2031-07-01', '2031-07-01T10:00:00.000Z'])('should take %s as the start of the term of a position', async (value) => {
            const res = await send('POST', '/events/' + event.id + '/positions', { ...generator.generatePosition(), start_term: value });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.start_term).toEqual('2031-07-01');
        });
    });
});
