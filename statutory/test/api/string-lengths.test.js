const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const models = require('../../models');

const TOO_LONG = 'a'.repeat(256);
const LONGEST = 'a'.repeat(255);

// A text column of 255 characters refuses a longer value with a validation error on
// the field. Long texts (descriptions, motivations) have no such limit.
describe('Values that are too long for their column', () => {
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

    const expectTooLong = (res, field) => {
        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors[field].join(' ')).toContain('at most 255 characters');
    };

    test.each(['name', 'url', 'booklet_folder'])('should refuse an event with a too long %s', async (field) => {
        const value = field === 'booklet_folder' ? 'https://example.org/' + TOO_LONG : TOO_LONG;

        const res = await send('POST', '/', generator.generateEvent({ type: 'agora', [field]: value }));

        expectTooLong(res, field);
        expect(await models.Event.count()).toEqual(1);
    });

    test('should refuse changing the name of an event to a too long one', async () => {
        const res = await send('PUT', '/events/' + event.id, { name: TOO_LONG });

        expectTooLong(res, 'name');
    });

    test.each([
        'nationality',
        'meals',
        'visa_place_of_birth',
        'visa_passport_number',
        'visa_passport_issue_date',
        'visa_passport_expiration_date',
        'visa_passport_issue_authority',
        'visa_embassy',
        'visa_street_and_house',
        'visa_postal_code',
        'visa_city',
        'visa_country'
    ])('should refuse an application with a too long %s', async (field) => {
        const res = await send('POST', '/events/' + event.id + '/applications', generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            [field]: TOO_LONG
        }, event));

        expectTooLong(res, field);
        expect(await models.Application.count()).toEqual(0);
    });

    test('should refuse changing a field of an application to a too long value', async () => {
        const application = await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id, { visa_city: TOO_LONG });

        expectTooLong(res, 'visa_city');
    });

    test.each(['name', 'end_term'])('should refuse a position with a too long %s', async (field) => {
        const res = await send('POST', '/events/' + event.id + '/positions', generator.generatePosition({ [field]: TOO_LONG }));

        expectTooLong(res, field);
        expect(await models.Position.count()).toEqual(0);
    });

    test.each([
        ['first_name', TOO_LONG],
        ['last_name', TOO_LONG],
        ['nationality', TOO_LONG],
        ['date_of_birth', '2000-01-01' + TOO_LONG],
        ['member_since', '2000-01-01' + TOO_LONG],
        ['languages', ['English', TOO_LONG]]
    ])('should refuse a candidature with a too long %s', async (field, value) => {
        const position = await generator.createPosition({}, event);

        const res = await send(
            'POST',
            '/events/' + event.id + '/positions/' + position.id + '/candidates',
            generator.generateCandidate({ body_id: regularUser.bodies[0].id, [field]: value })
        );

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty(field);
        expect(await models.Candidate.count()).toEqual(0);
    });

    test('should refuse a plenary with a too long name', async () => {
        const res = await send('POST', '/events/' + event.id + '/plenaries', generator.generatePlenary({ name: TOO_LONG }));

        expectTooLong(res, 'name');
        expect(await models.Plenary.count()).toEqual(0);
    });

    test('should refuse a question line with a too long name', async () => {
        const res = await send('POST', '/events/' + event.id + '/question-lines', generator.generateQuestionLine({ name: TOO_LONG }));

        expectTooLong(res, 'name');
        expect(await models.QuestionLine.count()).toEqual(0);
    });

    test('should refuse a memberslist with a too long currency', async () => {
        const res = await send(
            'POST',
            '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            generator.generateMembersList({ currency: TOO_LONG }, event)
        );

        expectTooLong(res, 'currency');
        expect(await models.MembersList.count()).toEqual(0);
    });

    test('should accept a value of exactly 255 characters', async () => {
        const res = await send('POST', '/events/' + event.id + '/plenaries', generator.generatePlenary({ name: LONGEST }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual(LONGEST);
    });

    test('should accept a long text where the column has no limit', async () => {
        const res = await send('PUT', '/events/' + event.id, { description: 'a'.repeat(5000) });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.description.length).toEqual(5000);
    });
});
