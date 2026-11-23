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
        const values = [['a text', 'garbage'], ['an empty text', ''], ['a number', 5], ['an array', [true]], ['an object', { value: true }]];

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
});
