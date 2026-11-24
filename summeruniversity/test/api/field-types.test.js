const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event, Application, Season } = require('../../models');
const fullPermissions = require('../assets/oms-core-permissions-full.json').data;
const user = require('../assets/oms-core-valid.json').data;

// Every writable field takes only values of its column's type, within the column's range:
// anything else answers 422 with the field, and nothing is stored.
const ABOVE_INT4 = 3000000000;

describe('Field types', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        // A manager of every type (who may also choose the season) and of the seasons.
        mock.mockAll({ mainPermissions: { permissions: [...fullPermissions.map((p) => p.combined), 'global:manage_seasons:summeruniversity'] } });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const call = (method, path, body) => request({ method, path, headers: { 'X-Auth-Token': 'foobar' }, body });

    const expectFieldError = (res, field, message) => {
        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors[field]).toContain(message);
    };

    describe('enums', () => {
        const rows = [
            ['type', ['pilot'], 'SU type should be one of these: regular, pilot.'],
            ['course_level', ['beginner'], 'SU course level should be one of these: beginner, intermediate, advanced.'],
            ['pax_confirmation', ['payment'], 'Pax confirmation should be one of these: no_confirmation, payment, ticket, payment_or_ticket, payment_and_ticket.'],
            ['theme_category', ['sports'], 'Theme should be one of these: arts_creativity, sustainability, local_culture, sports, social_equity, political_activism, mental_health, leisure, personal_development, volunteering.']
        ];

        test.each(rows)('creating a Summer University refuses a %s that is a list of one of its values', async (field, value, message) => {
            const res = await call('POST', '/', generator.generateEventBody({ [field]: value }));

            expectFieldError(res, field, message);
            expect(await Event.count()).toEqual(0);
        });

        test.each(rows)('editing a Summer University refuses a %s that is a list of one of its values', async (field, value, message) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { [field]: value });

            expectFieldError(res, field, message);
            expect((await Event.findByPk(event.id))[field]).toEqual(event[field]);
        });
    });

    describe('integers', () => {
        const values = [['a fraction', 1.5], ['above the integer range', ABOVE_INT4], ['an array', [20]], ['an object', { value: 20 }], ['a boolean', true]];
        const eventRows = [
            ['season', 'Season should be a year.', [...values, ['a text', 'abc'], ['below the integer range', -ABOVE_INT4]]],
            ['max_participants', 'Max amount of participants should be valid.', values]
        ].flatMap(([field, message, sent]) => sent.map(([name, value]) => [field, name, value, message]));

        test.each(eventRows)('creating a Summer University refuses a %s that is %s', async (field, _name, value, message) => {
            const res = await call('POST', '/', generator.generateEventBody({ [field]: value }));

            expectFieldError(res, field, message);
            expect(await Event.count()).toEqual(0);
        });

        test.each(eventRows)('editing a Summer University refuses a %s that is %s', async (field, _name, value, message) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { [field]: value });

            expectFieldError(res, field, message);
            expect((await Event.findByPk(event.id))[field]).toEqual(event[field]);
        });

        test.each(values)('the open call refuses a max_participants that is %s', async (_name, value) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}/open_call`, { open_call: true, max_participants: value });

            expectFieldError(res, 'max_participants', 'Max amount of participants should be valid.');
            const stored = await Event.findByPk(event.id);
            expect(stored.max_participants).toEqual(event.max_participants);
            expect(stored.open_call).toEqual(false);
        });

        test('a number sent as text is still taken', async () => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { max_participants: '25', season: '2025' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.max_participants).toEqual(25);
            expect(res.body.data.season).toEqual(2025);
        });

        test.each([['above the integer range', ABOVE_INT4], ['an array', [2040]], ['an object', { year: 2040 }]])('creating a season refuses a year that is %s', async (_name, year) => {
            const res = await call('POST', '/seasons', { year, name: 'Summer University 2040' });

            expectFieldError(res, 'year', 'Season year should be a valid year.');
            expect(await Season.count()).toEqual(6);
        });
    });

    describe('booleans', () => {
        // Sequelize itself reads 'true', 'false', 1 and 0 as booleans; the fields take only true and false.
        const values = [['a text', 'garbage'], ['an empty text', ''], ['a number', 5], ['an array', [true]], ['an object', { value: true }],
            ['true as text', 'true'], ['false as text', 'false'], ['the number 1', 1], ['the number 0', 0]];
        const AS_BOOLEANS = [['true as text', 'true'], ['the number 1', 1]];

        test.each(values)('creating a Summer University refuses a university_support that is %s', async (_name, value) => {
            const res = await call('POST', '/', generator.generateEventBody({ university_support: value }));

            expectFieldError(res, 'university_support', 'The value should be true or false.');
            expect(await Event.count()).toEqual(0);
        });

        test.each(values)('editing a Summer University refuses a university_support that is %s', async (_name, value) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { university_support: value });

            expectFieldError(res, 'university_support', 'The value should be true or false.');
            expect((await Event.findByPk(event.id)).university_support).toEqual(false);
        });

        test.each(values)('the open call refuses an open_call that is %s', async (_name, value) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}/open_call`, { open_call: value });

            expectFieldError(res, 'open_call', 'The value should be true or false.');
            expect((await Event.findByPk(event.id)).open_call).toEqual(false);
        });

        test.each(values)('applying refuses a visa_required that is %s', async (_name, value) => {
            const event = await generator.createEvent();

            const res = await call('POST', `/single/${event.id}/applications`, generator.generateApplicationBody(event, { body_id: user.bodies[0].id, visa_required: value }));

            expectFieldError(res, 'visa_required', 'The value should be true or false.');
            expect(await Application.count()).toEqual(0);
        });

        test.each(values)('editing an application refuses a visa_required that is %s', async (_name, value) => {
            const event = await generator.createEvent();
            const application = await generator.createApplication(event, { user_id: user.id, body_id: user.bodies[0].id });

            const res = await call('PUT', `/single/${event.id}/applications/${application.id}`, { visa_required: value });

            expectFieldError(res, 'visa_required', 'The value should be true or false.');
            expect((await Application.findByPk(application.id)).visa_required).toEqual(false);
        });

        // The edit forms sent the starting and ending city as the text 'true' (and send stored
        // locations back as they are), so a location still takes 'true' and 'false' as text.
        test('a location takes start and end as booleans or as text', async () => {
            const locations = [
                { name: 'Test city', position: { lat: 1, lng: 2 }, start: 'true', end: 'false' },
                { name: 'Other test city', position: { lat: 3, lng: 4 }, start: false, end: true }
            ];

            const res = await call('POST', '/', generator.generateEventBody({ locations }));

            expect(res.statusCode).toEqual(201);
            expect((await Event.findByPk(res.body.data.id)).locations).toEqual(locations);
        });

        test.each(AS_BOOLEANS)('creating a Summer University refuses an agreed_to_su_terms that is %s', async (_name, value) => {
            const res = await call('POST', '/', generator.generateEventBody({ agreed_to_su_terms: value }));

            expectFieldError(res, 'agreed_to_su_terms', 'You should agree to the SU terms.');
            expect(await Event.count()).toEqual(0);
        });

        test.each([
            ...AS_BOOLEANS.map(([name, value]) => ['agreed_to_privacy_policy', name, value, 'You should agree to Privacy Policy.']),
            ...AS_BOOLEANS.map(([name, value]) => ['agreed_to_su_terms', name, value, 'You should agree to the SU terms.'])
        ])('applying refuses an %s that is %s', async (field, _name, value, message) => {
            const event = await generator.createEvent();

            const res = await call('POST', `/single/${event.id}/applications`, generator.generateApplicationBody(event, { body_id: user.bodies[0].id, [field]: value }));

            expectFieldError(res, field, message);
            expect(await Application.count()).toEqual(0);
        });
    });

    describe('texts', () => {
        const EVENT_TEXTS = ['name', 'url', 'video', 'email', 'website', 'budget', 'programme_suct', 'accommodation_type',
            'description', 'theme', 'theme_implementation', 'trainers', 'pax_description', 'programme', 'activities_list',
            'optional_programme', 'courses', 'special_equipment', 'cancellation_rules', 'additional_regulation'];
        const APPLICATION_TEXTS = ['nationality', 'travelling_from', 'visa_place_of_birth', 'visa_passport_number',
            'visa_passport_issue_date', 'visa_passport_expiration_date', 'visa_passport_issue_authority', 'visa_embassy',
            'visa_street_and_house', 'visa_postal_code', 'visa_city', 'visa_country', 'meals', 'aegee_experience', 'ideal_su',
            'motivation', 'allergies'];
        const values = [['a number', 5], ['a boolean', true]];
        const rows = (fields) => fields.flatMap((field) => values.map(([name, value]) => [field, name, value]));
        const MESSAGE = 'The value should be a text.';

        test.each(rows(EVENT_TEXTS))('creating a Summer University refuses a %s that is %s', async (field, _name, value) => {
            const res = await call('POST', '/', generator.generateEventBody({ [field]: value }));

            expectFieldError(res, field, MESSAGE);
            expect(await Event.count()).toEqual(0);
        });

        test.each(rows(EVENT_TEXTS))('editing a Summer University refuses a %s that is %s', async (field, _name, value) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { [field]: value });

            expectFieldError(res, field, MESSAGE);
            expect((await Event.findByPk(event.id))[field]).toEqual(event[field]);
        });

        test.each(rows(APPLICATION_TEXTS))('applying refuses a %s that is %s', async (field, _name, value) => {
            const event = await generator.createEvent();

            const res = await call('POST', `/single/${event.id}/applications`, generator.generateApplicationBody(event, { body_id: user.bodies[0].id, [field]: value }));

            expectFieldError(res, field, MESSAGE);
            expect(await Application.count()).toEqual(0);
        });

        test.each(rows(APPLICATION_TEXTS))('editing an application refuses a %s that is %s', async (field, _name, value) => {
            const event = await generator.createEvent();
            const application = await generator.createApplication(event, { user_id: user.id, body_id: user.bodies[0].id });

            const res = await call('PUT', `/single/${event.id}/applications/${application.id}`, { [field]: value });

            expectFieldError(res, field, MESSAGE);
            expect((await Application.findByPk(application.id))[field]).toEqual(application[field]);
        });

        test.each(values)('creating a season refuses a name that is %s', async (_name, value) => {
            const res = await call('POST', '/seasons', { year: 2040, name: value });

            expectFieldError(res, 'name', MESSAGE);
            expect(await Season.count()).toEqual(6);
        });

        test.each(values)('editing a season refuses a name that is %s', async (_name, value) => {
            const res = await call('PUT', '/seasons/2026', { name: value });

            expectFieldError(res, 'name', MESSAGE);
            expect((await Season.findOne({ where: { year: 2026 } })).name).toEqual('Summer University 2026');
        });
    });

    describe('dates', () => {
        // A number is milliseconds since 1970, but only within the years 0001-9999 (Postgres
        // has no year 0000).
        const values = [['a number after the year 9999', 1e20], ['a number before the year 0001', -1e16],
            ['one millisecond after the year 9999', 253402300800000], ['one millisecond before the year 0001', -62135596800001],
            ['a day in the year 0000', '0000-07-01'], ['a timestamp that is in the year 0000 in UTC', '0001-01-01T00:30:00+01:00'],
            ['a boolean', true], ['an array', ['2027-07-01']], ['an object', { date: '2027-07-01' }],
            ['a lone number as text', '1'], ['a number as text', '1798761600000'], ['NaN as text', 'NaN'], ['Infinity as text', 'Infinity'],
            ['a day that does not exist', '2027-02-30'], ['a text', 'garbage']];
        const rows = (fields) => fields.flatMap(([field, message]) => values.map(([name, value]) => [field, name, value, message]));
        const EVENT_DATES = [['starts', 'Event start date should be valid.'], ['ends', 'Event end date should be valid.']];
        const PERIOD_DATES = [['application_starts', 'Event application starts date should be valid.'], ['application_ends', 'Event application end date should be valid.']];
        const SEASON_DATES = [['event_submission_deadline', 'Event submission deadline should be valid.'],
            ['application_period_starts', 'Application period start should be valid.'], ['application_period_ends', 'Application period end should be valid.']];

        test.each(rows(EVENT_DATES))('creating a Summer University refuses a %s that is %s', async (field, _name, value, message) => {
            const res = await call('POST', '/', generator.generateEventBody({ [field]: value }));

            expectFieldError(res, field, message);
            expect(await Event.count()).toEqual(0);
        });

        test.each(rows(EVENT_DATES))('editing a Summer University refuses a %s that is %s', async (field, _name, value, message) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { [field]: value });

            expectFieldError(res, field, message);
            expect((await Event.findByPk(event.id))[field]).toEqual(event[field]);
        });

        test.each(rows(PERIOD_DATES))('the application period refuses an %s that is %s', async (field, _name, value, message) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}/application_period`, { application_ends: generator.daysFromNow(5), [field]: value });

            expectFieldError(res, field, message);
            const stored = await Event.findByPk(event.id);
            expect(stored.application_starts).toEqual(event.application_starts);
            expect(stored.application_ends).toEqual(event.application_ends);
        });

        test.each(rows(SEASON_DATES))('creating a season refuses an %s that is %s', async (field, _name, value, message) => {
            const res = await call('POST', '/seasons', { year: 2040, name: 'Summer University 2040', [field]: value });

            expectFieldError(res, field, message);
            expect(await Season.count()).toEqual(6);
        });

        test.each(rows(SEASON_DATES))('editing a season refuses an %s that is %s', async (field, _name, value, message) => {
            const res = await call('PUT', '/seasons/2026', { [field]: value });

            expectFieldError(res, field, message);
            expect((await Season.findOne({ where: { year: 2026 } }))[field]).toEqual(null);
        });

        // JSON has no Infinity, but body-parser reads a number too large for a double as one.
        test.each([
            ['creating', 'POST', () => '/', () => JSON.stringify(generator.generateEventBody()).replace(/"starts":"[^"]*"/, '"starts":1e400')],
            ['editing', 'PUT', (event) => `/single/${event.id}`, () => '{"starts":1e400}']
        ])('%s a Summer University refuses a start that is an infinite number', async (_name, method, path, body) => {
            const event = await generator.createEvent();

            const res = await request({ method, path: path(event), headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json' }, rawBody: body() });

            expectFieldError(res, 'starts', 'Event start date should be valid.');
            expect(await Event.count()).toEqual(1);
            expect((await Event.findByPk(event.id)).starts).toEqual(event.starts);
        });

        const STARTS = Date.UTC(2027, 6, 1, 10, 30);
        const ENDS = Date.UTC(2027, 6, 11);

        test('creating a Summer University takes dates in milliseconds', async () => {
            const res = await call('POST', '/', generator.generateEventBody({ starts: STARTS, ends: ENDS }));

            expect(res.statusCode).toEqual(201);
            const event = await Event.findByPk(res.body.data.id);
            expect(event.starts.toISOString()).toEqual('2027-07-01T10:30:00.000Z');
            expect(event.ends.toISOString()).toEqual('2027-07-11T00:00:00.000Z');
        });

        test('editing a Summer University takes dates in milliseconds', async () => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { starts: STARTS, ends: ENDS });

            expect(res.statusCode).toEqual(200);
            const stored = await Event.findByPk(event.id);
            expect(stored.starts.toISOString()).toEqual('2027-07-01T10:30:00.000Z');
            expect(stored.ends.toISOString()).toEqual('2027-07-11T00:00:00.000Z');
        });

        test('the application period takes dates in milliseconds', async () => {
            const event = await generator.createEvent();
            const applicationStarts = Date.now() - 1000;
            const applicationEnds = Date.now() + 5 * 24 * 60 * 60 * 1000;

            const res = await call('PUT', `/single/${event.id}/application_period`, { application_starts: applicationStarts, application_ends: applicationEnds });

            expect(res.statusCode).toEqual(200);
            const stored = await Event.findByPk(event.id);
            expect(stored.application_starts.getTime()).toEqual(applicationStarts);
            expect(stored.application_ends.getTime()).toEqual(applicationEnds);
        });

        test.each([
            ['creating', 'POST', '/seasons', { year: 2040, name: 'Summer University 2040' }, 2040],
            ['editing', 'PUT', '/seasons/2026', {}, 2026]
        ])('%s a season takes dates in milliseconds', async (_name, method, path, body, year) => {
            const res = await call(method, path, { ...body, event_submission_deadline: STARTS, application_period_starts: STARTS, application_period_ends: ENDS });

            expect(res.statusCode).toBeLessThan(300);
            const season = await Season.findOne({ where: { year } });
            expect(season.event_submission_deadline.toISOString()).toEqual('2027-07-01T10:30:00.000Z');
            expect(season.application_period_ends.toISOString()).toEqual('2027-07-11T00:00:00.000Z');
        });

        test.each([
            ['the first millisecond of the year 0001', -62135596800000, '0001-01-01T00:00:00.000Z'],
            ['the last millisecond of the year 9999', 253402300799999, '9999-12-31T23:59:59.999Z']
        ])('a season takes %s', async (_name, value, stored) => {
            const res = await call('PUT', '/seasons/2026', { event_submission_deadline: value });

            expect(res.statusCode).toEqual(200);
            expect((await Season.findOne({ where: { year: 2026 } })).event_submission_deadline.toISOString()).toEqual(stored);
        });

        test.each([
            ['a day', '2027-07-01', '2027-07-01T00:00:00.000Z'],
            ['a timestamp in UTC', '2027-07-01T10:30:00.000Z', '2027-07-01T10:30:00.000Z'],
            ['a timestamp with an offset', '2027-07-01T10:30:00+02:00', '2027-07-01T08:30:00.000Z']
        ])('a season takes %s', async (_name, value, stored) => {
            const res = await call('PUT', '/seasons/2026', { event_submission_deadline: value });

            expect(res.statusCode).toEqual(200);
            expect((await Season.findOne({ where: { year: 2026 } })).event_submission_deadline.toISOString()).toEqual(stored);
        });
    });

    describe('decimals', () => {
        const values = [['an array', [5]], ['an array of text', ['5']], ['an object', { value: 5 }], ['a boolean', true],
            ['more decimals than the column keeps', `0.${'1'.repeat(16384)}`]];
        const rows = [['fee', 'Event fee should be valid.'], ['optional_fee', 'Optional fee should be valid.']]
            .flatMap(([field, message]) => values.map(([name, value]) => [field, name, value, message]));

        test.each(rows)('creating a Summer University refuses a %s that is %s', async (field, _name, value, message) => {
            const res = await call('POST', '/', generator.generateEventBody({ [field]: value }));

            expectFieldError(res, field, message);
            expect(await Event.count()).toEqual(0);
        });

        test.each(rows)('editing a Summer University refuses a %s that is %s', async (field, _name, value, message) => {
            const event = await generator.createEvent({ status: 'first draft', published: 'none' });

            const res = await call('PUT', `/single/${event.id}`, { [field]: value });

            expectFieldError(res, field, message);
            expect(Number((await Event.findByPk(event.id))[field])).toEqual(Number(event[field]));
        });

        test('a fee takes a number with decimals, also as text', async () => {
            const res = await call('POST', '/', generator.generateEventBody({ fee: '12.50', optional_fee: 7.25 }));

            expect(res.statusCode).toEqual(201);
            const event = await Event.findByPk(res.body.data.id);
            expect(Number(event.fee)).toEqual(12.5);
            expect(Number(event.optional_fee)).toEqual(7.25);
        });
    });

    describe('lists', () => {
        const notLists = [['a text', 'garbage'], ['a number', 5], ['a boolean', true], ['an object', { value: 1 }]];
        const eventRows = [
            ...[[null], [5], ['Why?'], [{}], [{ description: 5 }]].map((value) => ['questions', JSON.stringify(value), value, 'Every question should have a description.']),
            ...notLists.map(([name, value]) => ['photos', name, value, 'Photos should be a list.']),
            ...notLists.map(([name, value]) => ['learning_objectives', name, value, 'Learning objectives should be a list.']),
            ...[[{ description: 'Why?', other: 1 }], [{ description: 'Why?', name: 5 }], [{ description: 'Why?', required: 'yes' }]]
                .map((value) => ['questions', JSON.stringify(value), value, 'A question can only have a name (text), a description (text) and required (true or false).']),
            ...[[{ description: 'https://example.org', other: 1 }], [{ description: 'https://example.org', name: 5 }]]
                .map((value) => ['social_media', JSON.stringify(value), value, 'A social media entry can only have a name (text) and a description (the link).']),
            ['organizing_bodies', 'a list with null', [null], 'Body is malformed.'],
            ['cooperation', 'a list with null', [null], 'Body is malformed.']
        ];

        test.each(eventRows)('creating a Summer University refuses %s that are %s', async (field, _name, value, message) => {
            const res = await call('POST', '/', generator.generateEventBody({ [field]: value }));

            expectFieldError(res, field, message);
            expect(await Event.count()).toEqual(0);
        });

        test.each(eventRows)('editing a Summer University refuses %s that are %s', async (field, _name, value, message) => {
            const event = await generator.createEvent();

            const res = await call('PUT', `/single/${event.id}`, { [field]: value });

            expectFieldError(res, field, message);
            expect((await Event.findByPk(event.id))[field]).toEqual(event[field]);
        });

        test('questions and social media entries take the fields the frontend sends', async () => {
            const questions = [{ name: '', description: 'Why?', required: true }, { description: 'And?' }];
            const socialMedia = [{ name: '', description: 'https://example.org/aegee' }, { description: 'https://example.org' }];

            const res = await call('POST', '/', generator.generateEventBody({ questions, social_media: socialMedia }));

            expect(res.statusCode).toEqual(201);
            const event = await Event.findByPk(res.body.data.id);
            expect(event.questions).toEqual(questions);
            expect(event.social_media).toEqual(socialMedia);
        });

        test('creating a Summer University refuses organizers that are not objects', async () => {
            const res = await call('POST', '/', generator.generateEventBody({ organizers: [null, ...generator.generateOrganizers()] }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('organizers');
            expect(await Event.count()).toEqual(0);
        });

        const answers = [[5], [null], [{}], [[]]];

        test.each(answers.map((value) => [JSON.stringify(value), value]))('applying refuses answers that are %s', async (_name, value) => {
            const event = await generator.createEvent();

            const res = await call('POST', `/single/${event.id}/applications`, generator.generateApplicationBody(event, { body_id: user.bodies[0].id, answers: value }));

            expectFieldError(res, 'answers', 'Answers should be an array of strings.');
            expect(await Application.count()).toEqual(0);
        });

        test.each(answers.map((value) => [JSON.stringify(value), value]))('editing an application refuses answers that are %s', async (_name, value) => {
            const event = await generator.createEvent();
            const application = await generator.createApplication(event, { user_id: user.id, body_id: user.bodies[0].id });

            const res = await call('PUT', `/single/${event.id}/applications/${application.id}`, { answers: value });

            expectFieldError(res, 'answers', 'Answers should be an array of strings.');
            expect((await Application.findByPk(application.id)).answers).toEqual(application.answers);
        });
    });
});
