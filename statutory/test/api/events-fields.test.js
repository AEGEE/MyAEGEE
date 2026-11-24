const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');

describe('Events fields', () => {
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

    test('should return all applications fields', async () => {
        const event = await generator.createEvent();
        const res = await request({
            path: '/events/' + event.id + '/fields/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should return all incoming fields', async () => {
        const event = await generator.createEvent();
        const res = await request({
            path: '/events/' + event.id + '/fields/applications/incoming',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should return candidates fields', async () => {
        const event = await generator.createEvent();
        const res = await request({
            path: '/events/' + event.id + '/fields/candidates',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    const questions = [
        { type: 'string', description: 'What is your t-shirt size?', required: true },
        { type: 'checkbox', description: 'Do you need a visa?', required: false }
    ];

    const getFields = async (event, suffix, headers = { 'X-Auth-Token': 'blablabla' }) => {
        const res = await request({
            path: '/events/' + event.id + '/fields/' + suffix,
            method: 'GET',
            headers
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        return res.body.data;
    };

    test('should name every field of an application, and one field per question of the event', async () => {
        const event = await generator.createEvent({ questions });

        const fields = await getFields(event, 'applications/all');

        expect(fields).toEqual({
            ...constants.APPLICATION_FIELD_NAMES,
            'answers.0': 'Answer 1: What is your t-shirt size?',
            'answers.1': 'Answer 2: Do you need a visa?'
        });
        expect(fields).toMatchObject({
            id: 'ID',
            first_name: 'First name',
            notification_email: 'Email',
            visa_passport_number: 'Visa: passport number',
            board_comment: 'Board comment'
        });
    });

    test('should name the answers of the event in the path, not those of another event', async () => {
        const event = await generator.createEvent({ questions: [questions[0]] });
        await generator.createEvent({ questions });

        const fields = await getFields(event, 'applications/all');

        expect(Object.keys(fields).filter((field) => field.startsWith('answers'))).toEqual(['answers.0']);
    });

    // BUG: the local organisers get the answers of an application, but the answers have no
    // title, so they are missing from this list (the list of all fields names one field per
    // question). Expected: 'answers.0', 'answers.1'... as in /fields/applications/all.
    test('should name the fields the local organisers get, without the answers', async () => {
        const event = await generator.createEvent({ questions });

        const fields = await getFields(event, 'applications/incoming');

        expect(Object.keys(fields)).toEqual(constants.ALLOWED_INCOMING_FIELDS.filter((field) => field !== 'answers'));
        expect(fields).toMatchObject({
            id: 'ID',
            first_name: 'First name',
            meals: 'Meals',
            visa_passport_number: 'Visa: passport number'
        });
        // Not for the local organisers.
        for (const field of ['notification_email', 'board_comment', 'status', 'gender', 'nationality']) {
            expect(fields).not.toHaveProperty(field);
        }
    });

    test('should name the fields of a candidature', async () => {
        const event = await generator.createEvent({ type: 'agora' });

        const fields = await getFields(event, 'candidates');

        expect(fields).toEqual(constants.CANDIDATE_FIELDS);
        expect(fields).toMatchObject({
            first_name: 'First name',
            'position.name': 'Position',
            attended_epm: 'Number of EPMs visited',
            notification_email: 'Email'
        });
    });

    test('should name the fields of a candidature for an event that is not an Agora too', async () => {
        const event = await generator.createEvent({ type: 'epm' });

        expect(await getFields(event, 'candidates')).toEqual(constants.CANDIDATE_FIELDS);
    });

    test.each([
        'applications/all',
        'applications/incoming',
        'candidates'
    ])('should give an anonymous caller the same names on /fields/%s as a member without permissions', async (suffix) => {
        const event = await generator.createEvent({ questions });

        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const asMember = await getFields(event, suffix);

        mock.mockAll({
            core: { unauthorized: true },
            mainPermissions: { unauthorized: true },
            approvePermissions: { unauthorized: true },
            memberslistPermissions: { unauthorized: true }
        });
        const asAnonymous = await getFields(event, suffix, {});

        expect(Object.keys(asAnonymous).length).toBeGreaterThan(10);
        expect(asAnonymous).toEqual(asMember);
    });
});
