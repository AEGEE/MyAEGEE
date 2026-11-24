const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const {
    Event,
    Application,
    MembersList,
    Position,
    Plenary,
    QuestionLine,
    Question,
    Candidate
} = require('../../models');

const TEXT = 'The value should be a text.';
const TEXTS = 'The value should be a list of texts.';
const BOOLEAN = 'The value should be true or false.';

// A text field takes a text (or null where it may be empty), a list of texts a list of texts,
// and a yes/no field true or false (or null where it may be empty). Anything else answers 422
// with a message under the field, and nothing is stored. Whole numbers may still be sent as text.
describe('Types of the fields', () => {
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

    const expectRefused = (res, field, message) => {
        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors[field]).toContain(message);
    };

    describe('events', () => {
        test.each([
            ['name', 2026, TEXT],
            ['description', { text: 'x' }, TEXT],
            ['booklet_folder', 12, TEXT],
            ['vegetarian', 'true', BOOLEAN],
            ['vegetarian', 1, BOOLEAN]
        ])('creating an event with %s %j answers 422', async (field, value, message) => {
            const res = await send('POST', '/', { ...generator.generateEvent({ type: 'epm' }), [field]: value });

            expectRefused(res, field, message);
            expect(await Event.count()).toEqual(1);
        });

        test.each([
            ['name', 2026, TEXT],
            ['vegetarian', 'false', BOOLEAN]
        ])('editing an event with %s %j answers 422', async (field, value, message) => {
            const res = await send('PUT', '/events/' + event.id, { [field]: value });

            expectRefused(res, field, message);
            expect((await Event.findByPk(event.id))[field]).toEqual(event[field]);
        });

        test('a text field that may be empty takes null', async () => {
            const res = await send('PUT', '/events/' + event.id, { booklet_folder: null });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.booklet_folder).toEqual(null);
        });
    });

    describe('applications', () => {
        test.each([
            ['nationality', 1, TEXT],
            ['allergies', ['nuts'], TEXT],
            ['visa_postal_code', 1234, TEXT],
            ['visa_required', 'true', BOOLEAN]
        ])('applying with %s %j answers 422', async (field, value, message) => {
            const res = await send('POST', '/events/' + event.id + '/applications', generator.generateApplication({
                body_id: regularUser.bodies[0].id,
                [field]: value
            }, event));

            expectRefused(res, field, message);
            expect(await Application.count()).toEqual(0);
        });

        test('editing an application with allergies 5 answers 422', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

            const res = await send('PUT', '/events/' + event.id + '/applications/me', { allergies: 5 });

            expectRefused(res, 'allergies', TEXT);
            expect((await Application.findByPk(application.id)).allergies).toEqual(application.allergies);
        });

        test('the edit form sends null for the empty fields of an application without a visa', async () => {
            await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id, visa_required: false, allergies: null }, event);

            const res = await send('PUT', '/events/' + event.id + '/applications/me', {
                visa_required: false,
                visa_place_of_birth: null,
                visa_postal_code: null,
                allergies: null,
                number_of_events_visited: '3'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.number_of_events_visited).toEqual(3);
        });

        test.each(['confirmed', 'incoming'])('setting %s to "true" answers 422', async (flag) => {
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id + '/' + flag, { [flag]: 'true' });

            expectRefused(res, flag, BOOLEAN);
            expect((await Application.findByPk(application.id))[flag]).toEqual(false);
        });

        test('a board comment that is no text answers 422', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_members:agora'] } });
            const application = await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

            const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id + '/board', { board_comment: 42 });

            expectRefused(res, 'board_comment', TEXT);
            expect((await Application.findByPk(application.id)).board_comment).toEqual(application.board_comment);
        });

        test('a board comment takes null', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_members:agora'] } });
            const application = await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

            const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id + '/board', { board_comment: null });

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('members lists', () => {
        test.each([0, 1.5, true, 2147483648])('a currency %j answers 422', async (currency) => {
            const res = await send('POST', '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id, generator.generateMembersList({ currency }));

            expectRefused(res, 'currency', TEXT);
            expect(await MembersList.count()).toEqual(0);
        });
    });

    describe('positions, plenaries, question lines, questions and candidatures', () => {
        test.each([
            ['a position', 'name', (e) => generator.createPosition({}, e), (e, position) => '/events/' + e.id + '/positions/' + position.id, Position],
            ['a position', 'end_term', (e) => generator.createPosition({}, e), (e, position) => '/events/' + e.id + '/positions/' + position.id, Position],
            ['a plenary', 'name', (e) => generator.createPlenary({}, e), (e, plenary) => '/events/' + e.id + '/plenaries/' + plenary.id, Plenary],
            ['a question line', 'name', (e) => generator.createQuestionLine({}, e), (e, line) => '/events/' + e.id + '/question-lines/' + line.id, QuestionLine]
        ])('editing %s with a number as %s answers 422', async (description, field, create, path, Model) => {
            const record = await create(event);

            const res = await send('PUT', path(event, record), { [field]: 2026 });

            expectRefused(res, field, TEXT);
            expect((await Model.findByPk(record.id))[field]).toEqual(record[field]);
        });

        test('editing a question with a number as its text answers 422', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({}, event);
            const question = await generator.createQuestion({ application_id: application.id }, questionLine);

            const res = await send('PUT', '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id, { text: 2026 });

            expectRefused(res, 'text', TEXT);
            expect((await Question.findByPk(question.id)).text).toEqual(question.text);
        });

        test.each([
            ['nationality', 2026, TEXT],
            ['languages', ['English', 2], TEXTS],
            ['languages', 'English', TEXTS]
        ])('editing a candidature with %s %j answers 422', async (field, value, message) => {
            const position = await generator.createPosition({}, event);
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id, { [field]: value });

            expectRefused(res, field, message);
            expect((await Candidate.findByPk(candidate.id))[field]).toEqual(candidate[field]);
        });
    });
});
