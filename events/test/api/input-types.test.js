const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event, Application } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

// Every field a client can write takes only values of its type that fit its column: anything
// else answers 422 on that field and nothing is stored, instead of a 500 from the database
// or a value stored as text.
const LONG_TEXT = 'a'.repeat(300);
const ABOVE_INT4 = 2 ** 31;
// Numbers are milliseconds. Postgres has no year 0, so dates outside the years 0001 to 9999
// are refused, also as text.
const WRONG_DATES = [
    'garbage', '1', '2020-02-31', [], {}, true, '0000-07-01',
    1e20, -1e16, Date.parse('0001-01-01T00:00:00.000Z') - 1, Date.parse('9999-12-31T23:59:59.999Z') + 1
];
const NOT_TEXT = [[], {}, 5, true];
// More than 16383 digits after the point (what a Postgres NUMERIC keeps) or 308 before it
// (what reads back as a number).
const WRONG_DECIMALS = ['abc', [], {}, true, '5.', '1,5', '0.' + '0'.repeat(16383) + '1', '1e-16384', '1e308', '1' + '0'.repeat(308), '1e131072'];

const EVENT_CASES = [
    ['name', [LONG_TEXT, ...NOT_TEXT]],
    ['url', [LONG_TEXT, ...NOT_TEXT]],
    ['description', NOT_TEXT],
    ['application_starts', WRONG_DATES],
    ['application_ends', WRONG_DATES],
    ['starts', WRONG_DATES],
    ['ends', WRONG_DATES],
    ['fee', [...WRONG_DECIMALS, '']],
    ['optional_fee', WRONG_DECIMALS],
    ['max_participants', [ABOVE_INT4, 3000000000, 1.5, 'abc', [], {}, true, -1]],
    ['meals_per_day', [ABOVE_INT4, 1.5, 'abc', [], {}, true]],
    ['budget', NOT_TEXT],
    ['programme', NOT_TEXT],
    ['optional_programme', NOT_TEXT],
    ['link_info_travel_country', NOT_TEXT],
    ['accommodation_type', [LONG_TEXT, ...NOT_TEXT]],
    ['vegetarian', ['yes', [], {}, 1]],
    ['has_applications', ['yes', [], {}, 1]],
    ['type', [['training'], { type: 'training' }, 1]],
    ['method', [['online'], { method: 'online' }, 1]],
    ['locations', [
        'garbage', {}, [null], [1], [{ name: 'Here' }], [{ name: 5, position: { lat: 1, lng: 2 } }],
        [{ name: 'Here', position: null }], [{ name: 'Here', position: { lat: '1', lng: 2 } }],
        [{ name: 'Here', position: { lat: 1, lng: [] } }], [{ name: 'Here', position: [1, 2] }]
    ]],
    ['questions', [
        'garbage', {}, [null], [1], [[]], [{ description: 'Why?', type: 'string', required: 'yes' }],
        [{ description: 5, type: 'string', required: true }], [{ description: 'Why?', type: ['string'], required: true }],
        [{ description: 'Pick', type: 'select', required: true, values: 'a' }],
        [{ description: 'Pick', type: 'select', required: true, values: [1] }],
        [{ description: 'Why?', type: 'unknown', required: true }]
    ]]
];

const fieldsOf = (Model) => Object.keys(Model.rawAttributes);

describe('Input types', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    // A valid event of the user's first body, in the format the frontend sends.
    const newEvent = (fields) => ({
        name: 'Develop Yourself 4',
        description: 'Test',
        application_starts: moment().add(1, 'week').format('YYYY-MM-DD HH:mm'),
        application_ends: moment().add(2, 'weeks').format('YYYY-MM-DD HH:mm'),
        starts: moment().add(3, 'weeks').format('YYYY-MM-DD HH:mm'),
        ends: moment().add(4, 'weeks').format('YYYY-MM-DD HH:mm'),
        type: 'cultural',
        organizing_bodies: [{ body_id: user.bodies[0].id }],
        organizers: [{ user_id: user.id }],
        meals_per_day: 2,
        accommodation_type: 'hotel',
        ...fields
    });

    test('the valid event used below is created', async () => {
        const res = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: newEvent({}) });

        expect(res.statusCode).toEqual(201);
    });

    describe.each(EVENT_CASES)('Event.%s', (field, values) => {
        test.each(values.map((value) => [JSON.stringify(value).slice(0, 40), value]))('answers 422 for %s on create', async (_name, value) => {
            const res = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: newEvent({ [field]: value }) });

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body.errors)).toContain(field);
            expect(await Event.count()).toEqual(0);
        });

        test.each(values.map((value) => [JSON.stringify(value).slice(0, 40), value]))('answers 422 for %s on edit', async (_name, value) => {
            const event = await generator.createEvent({ questions: [], locations: [] });
            const before = await Event.findByPk(event.id, { raw: true });

            const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { [field]: value } });

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body.errors)).toContain(field);
            expect(await Event.findByPk(event.id, { raw: true })).toEqual(before);
        });
    });

    test('every writable field of Event is in the table above', () => {
        // Set by the server, not by the client: on create and edit they are dropped or
        // replaced (organizers and organizing bodies are rebuilt from core and checked in
        // events-creation and events-editing).
        const serverSet = ['id', 'image', 'status', 'deleted', 'is_european_event', 'publication_date',
            'organizing_bodies', 'organizers', 'application_status', 'created_at', 'updated_at'];
        expect(fieldsOf(Event).filter((field) => !serverSet.includes(field)).sort())
            .toEqual(EVENT_CASES.map(([field]) => field).sort());
    });

    test.each([
        ['created_at', '2001-01-01T00:00:00.000Z'],
        ['created_at', 'garbage'],
        ['updated_at', 'garbage']
    ])('ignores %s from the body on create (%s)', async (field, value) => {
        const res = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: newEvent({ [field]: value }) });

        expect(res.statusCode).toEqual(201);
        const event = await Event.findByPk(res.body.data.id);
        expect(moment(event[field]).isAfter(moment().subtract(1, 'minute'))).toEqual(true);
    });

    test.each(['2001-01-01T00:00:00.000Z', 'garbage'])('ignores publication_date from the body on create and edit (%s)', async (value) => {
        const created = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: newEvent({ publication_date: value }) });

        expect(created.statusCode).toEqual(201);
        expect(created.body.data.publication_date).toEqual(null);

        const edited = await request({ path: '/single/' + created.body.data.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { publication_date: value, name: 'Renamed' } });

        expect(edited.statusCode).toEqual(200);
        expect((await Event.findByPk(created.body.data.id)).publication_date).toEqual(null);
    });

    test('stores only the documented keys of questions and locations', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'foobar' },
            body: newEvent({
                questions: [{ name: '', description: 'Why?', type: 'string', required: true, extra: 1 }],
                locations: [{ name: 'Here', position: { lat: 1, lng: 2, alt: 3 }, extra: 1 }]
            })
        });

        expect(res.statusCode).toEqual(201);
        const event = await Event.findByPk(res.body.data.id);
        expect(event.questions).toEqual([{ description: 'Why?', type: 'string', required: true }]);
        expect(event.locations).toEqual([{ name: 'Here', position: { lat: 1, lng: 2 } }]);
    });

    test('takes no fee for an online event', async () => {
        const res = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: newEvent({ method: 'online', fee: null, optional_fee: null }) });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.fee).toEqual(null);
    });

    test('keeps created_at on edit', async () => {
        const event = await generator.createEvent();
        const before = await Event.findByPk(event.id);

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { created_at: '2001-01-01T00:00:00.000Z', name: 'Renamed' } });

        expect(res.statusCode).toEqual(200);
        const after = await Event.findByPk(event.id);
        expect(after.created_at).toEqual(before.created_at);
    });

    test.each([
        ['2026-12-01'],
        ['2026-12-01 15:00'],
        ['2026-12-01T15:00:00.000Z'],
        ['2026-12-01T15:00:00+01:00'],
        [new Date('2026-12-01T15:00:00.000Z').getTime()]
    ])('takes the date %s', async (value) => {
        const event = await generator.createEvent({
            application_starts: moment('2026-11-01').toDate(),
            application_ends: moment('2026-11-15').toDate(),
            starts: moment('2026-11-20').toDate(),
            ends: moment('2027-01-01').toDate()
        });

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { starts: value } });

        expect(res.statusCode).toEqual(200);
        const after = await Event.findByPk(event.id);
        expect(after.starts.getTime()).toEqual(new Date(value).getTime());
    });

    // An <input type="number"> can submit '.5' and '1e2'.
    test.each([
        ['.5', 0.5], ['+5', 5], ['1e2', 100], ['2.50', 2.5], ['1E-2', 0.01], [0.5, 0.5], ['1e307', 1e307], ['9'.repeat(308), Number('9'.repeat(308))]
    ])('takes the fee %s', async (value, stored) => {
        const res = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: newEvent({ fee: value, optional_fee: value }) });

        expect(res.statusCode).toEqual(201);
        const event = await Event.findByPk(res.body.data.id);
        expect(event.fee).toEqual(stored);
        expect(event.optional_fee).toEqual(stored);
    });

    // The edit form sends an online event without applications with an application end of
    // `starts` minus one minute, as a number of milliseconds.
    test('creates an online event without applications as the form sends it', async () => {
        const starts = moment().add(3, 'weeks').toDate();
        const form = JSON.parse(JSON.stringify(newEvent({
            method: 'online',
            has_applications: false,
            fee: null,
            optional_fee: null,
            questions: [],
            locations: [],
            starts,
            ends: moment().add(4, 'weeks').toDate(),
            application_starts: moment()
        })));
        form.application_ends = starts - moment.duration(1, 'minutes');

        const res = await request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: form });

        expect(res.statusCode).toEqual(201);
        const event = await Event.findByPk(res.body.data.id);
        expect(event.application_ends.getTime()).toEqual(starts.getTime() - 60000);
    });

    test('edits an online event without applications as the form sends it', async () => {
        const event = await generator.createEvent({ method: 'online', has_applications: false });
        const loaded = await request({ path: '/single/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });
        const form = { ...loaded.body.data, name: 'Renamed online event' };
        form.organizing_bodies = form.organizing_bodies.map((body) => ({ body_id: body.body_id }));
        form.organizers = form.organizers.map((organizer) => ({ user_id: organizer.user_id }));
        form.application_starts = JSON.parse(JSON.stringify(moment()));
        form.application_ends = new Date(form.starts) - moment.duration(1, 'minutes');

        const res = await request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: form });

        expect(res.statusCode).toEqual(200);
        const after = await Event.findByPk(event.id);
        expect(after.name).toEqual('Renamed online event');
        expect(after.application_ends.getTime()).toEqual(new Date(loaded.body.data.starts).getTime() - 60000);
    });

    describe('Application', () => {
        const APPLICATION_CASES = [
            ['body_id', [ABOVE_INT4, 1.5, 'abc', [], {}, true]],
            ['answers', ['garbage', {}, [null], [[]], [{}]]],
            ['agreed_to_privacy_policy', ['yes', [], {}, 1]]
        ];

        // A published event with an open application period and one question of each kind
        // the answers can be checked against.
        const openEvent = () => generator.createEvent({
            application_starts: moment().subtract(1, 'week').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{ description: 'Why?', type: 'string', required: true }]
        });

        test('every writable field of Application is in the table', () => {
            const writable = ['body_id', 'answers', 'agreed_to_privacy_policy'];
            expect(APPLICATION_CASES.map(([field]) => field)).toEqual(writable);
            expect(fieldsOf(Application)).toEqual(expect.arrayContaining(writable));
        });

        describe.each(APPLICATION_CASES)('Application.%s', (field, values) => {
            test.each(values.map((value) => [JSON.stringify(value).slice(0, 40), value]))('answers 422 for %s on create and edit', async (_name, value) => {
                const event = await openEvent();
                const valid = { body_id: user.bodies[0].id, answers: ['Because'], agreed_to_privacy_policy: true };

                const created = await request({ path: '/single/' + event.id + '/applications', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body: { ...valid, [field]: value } });

                expect([400, 422]).toContain(created.statusCode);
                if (created.statusCode === 422) {
                    expect(Object.keys(created.body.errors)).toContain(field);
                }
                expect(await Application.count()).toEqual(0);

                const application = await generator.createApplication(event, { user_id: user.id, body_id: user.bodies[0].id, answers: ['Because'] });
                const before = await Application.findByPk(application.id, { raw: true });

                const edited = await request({ path: '/single/' + event.id + '/applications/' + application.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body: { [field]: value } });

                expect([403, 422]).toContain(edited.statusCode);
                expect(await Application.findByPk(application.id, { raw: true })).toEqual(before);
            });
        });
    });
});
