const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const mails = require('../assets/core-notification-mails.json').data;
const { sequelize } = require('../../lib/sequelize');
const { Application, VotesPerAntenna } = require('../../models');

const MARKER = '<b>request-value</b>';
const INTERNAL = { success: false, message: 'Internal server error.' };

// No message repeats a value of the request, and a 500 carries a fixed text: the details
// are in the log only.
describe('Messages', () => {
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
            questions: [
                generator.generateQuestionForEvent({ type: 'number', description: 'How many?' }),
                generator.generateQuestionForEvent({ type: 'select', description: 'Which one?', values: ['First', 'Second'] })
            ],
            applications: []
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (options) => request({ headers: { 'X-Auth-Token': 'blablabla' }, ...options });

    // With answers to the questions of the event.
    const createApplication = (fields = {}) => generator.createApplication({ answers: ['3', 'First'], ...fields }, event);

    const expectNoMarker = (res) => {
        expect(JSON.stringify(res.body)).not.toContain('request-value');
    };

    describe('the lists of applications', () => {
        test.each([
            ['sort[field] that is not supported', { sort: { field: MARKER } }, 'Sorting by this field is not supported.'],
            ['sort[field] as a list', 'sort[field][]=id', 'Sorting by this field is not supported.'],
            ['sort[order] as a list', 'sort[order][]=asc', 'The sorting order should be "asc" or "desc".'],
            ['sort[order] that is not supported', { sort: { order: MARKER } }, 'The sorting order should be "asc" or "desc".'],
            ['limit as a list', 'limit[]=1', 'The "limit" parameter should be a whole number, zero or higher.'],
            ['offset as an object', 'offset[a]=1', 'The "offset" parameter should be a whole number, zero or higher.']
        ])('%s answers 400', async (description, query, message) => {
            for (const list of ['all', 'incoming', 'juridical', 'network']) {
                const path = '/events/' + event.id + '/applications/' + list;
                const res = typeof query === 'string'
                    ? await send({ path: path + '?' + query, method: 'GET' })
                    : await send({ path, query, method: 'GET' });

                expect({ list, status: res.statusCode, body: res.body }).toEqual({ list, status: 400, body: { success: false, message } });
            }
        });

        test('a filter field of the mass mailer that is not supported answers 400', async () => {
            await createApplication();

            const res = await send({ path: '/events/' + event.id + '/massmailer', method: 'POST', body: { subject: 'S', text: 'T', filter: { [MARKER]: true } } });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toMatch(/^Filtering by this field is not supported\./);
            expectNoMarker(res);
        });
    });

    test('a currency that is not known answers 422', async () => {
        const res = await send({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            body: generator.generateMembersList({ currency: MARKER.slice(0, 2) })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toEqual({ currency: ['The currency is not known.'] });
    });

    test('an export prefix that is not supported answers 400', async () => {
        const res = await send({ path: '/events/' + event.id + '/applications/export/' + encodeURIComponent(MARKER), method: 'GET', query: { select: ['id'] } });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The prefix should be "all" or "incoming".' });
    });

    test('a route that does not exist is named without its query', async () => {
        const res = await send({ path: '/no-such-route?token=' + encodeURIComponent(MARKER), method: 'GET' });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'No such API endpoint: GET /no-such-route' });
    });

    test('an image with an extension that is not allowed answers 422 with the allowed ones', async () => {
        const res = await send({
            path: '/events/' + event.id + '/image',
            method: 'POST',
            files: { image: { path: './test/assets/invalid_image.txt', filename: 'image.request-value' } }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toMatch(/^Allowed extensions: /);
        expectNoMarker(res);
    });

    describe('the answers of an application', () => {
        test.each([
            ['a number question', ['request-value', 'First'], 'Answer number 1 ("How many?") should be a number.'],
            ['a select question', ['3', 'request-value'], 'Answer number 2 ("Which one?") should be one of these: First, Second.']
        ])('a wrong answer to %s answers 422', async (description, answers, message) => {
            const res = await send({
                path: '/events/' + event.id + '/applications',
                method: 'POST',
                body: generator.generateApplication({ body_id: regularUser.bodies[0].id, answers }, event)
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.answers).toEqual([message]);
        });
    });

    test('a question type that is not supported answers 422', async () => {
        const res = await send({
            path: '/events/' + event.id,
            method: 'PUT',
            body: { questions: [{ type: MARKER, description: 'A question', required: true }] }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.questions).toEqual(['Question 1: the type should be one of these: string, text, number, checkbox, select.']);
    });

    describe('errors of the service', () => {
        test('core that answers garbage gives a fixed text', async () => {
            mock.mockAll({ core: { badResponse: true } });

            const res = await send({ path: '/mine', method: 'GET' });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual(INTERNAL);
        });

        test('core that fails on a lookup gives a fixed text', async () => {
            mock.mockAll({ body: { badResponse: true } });

            const res = await send({
                path: '/events/' + event.id + '/applications',
                method: 'POST',
                body: generator.generateApplication({ body_id: regularUser.bodies[0].id, answers: ['3', 'First'] }, event)
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual(INTERNAL);
        });

        test('a mailer that refuses the mass mail gives a fixed text', async () => {
            mock.mockAll({ mailer: { unsuccessfulResponse: true } });
            // A user whose address core gives.
            await createApplication({ user_id: mails[0].id });

            const res = await send({ path: '/events/' + event.id + '/massmailer', method: 'POST', body: { subject: 'S', text: 'T' } });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual({ success: false, message: 'The mailer did not take the mails. Some of them may have been sent.' });
        });
    });

    describe('the board routes', () => {
        const BODY_ID = regularUser.bodies[0].id;

        const holdingVotes = (whileHeld) => sequelize.transaction(async (t) => {
            await sequelize.query('SELECT * FROM votes_per_antenna WHERE event_id = :eventId AND body_id = :bodyId FOR UPDATE', {
                replacements: { eventId: event.id, bodyId: BODY_ID },
                transaction: t
            });
            return whileHeld();
        });

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_members:agora'] } });
            await VotesPerAntenna.create({ event_id: event.id, body_id: BODY_ID, votes: 3 });
        });

        test('setting the board of an application answers an error of the service as such, not as 403', async () => {
            const application = await createApplication({ user_id: 2, body_id: BODY_ID, participant_type: null, participant_order: null });

            const res = await holdingVotes(() => send({
                path: '/events/' + event.id + '/applications/' + application.id + '/board',
                method: 'PUT',
                body: { participant_type: 'delegate', participant_order: 1 }
            }));

            expect(res.statusCode).toEqual(503);
            expect((await Application.findByPk(application.id)).participant_type).toEqual(null);
        }, 20000);

        test('setting the board of a body answers an error of the service as such, not as 403', async () => {
            await createApplication({ user_id: 2, body_id: BODY_ID, participant_type: null, participant_order: null });

            const res = await holdingVotes(() => send({
                path: '/events/' + event.id + '/applications/boardview/' + BODY_ID,
                method: 'POST',
                body: [{ user_id: 2, participant_type: 'delegate', participant_order: 1 }]
            }));

            expect(res.statusCode).toEqual(503);
        }, 20000);

        test('an application of the board view that is not found answers 403 without the values of the request', async () => {
            const res = await send({
                path: '/events/' + event.id + '/applications/boardview/' + BODY_ID,
                method: 'POST',
                body: [{ user_id: 424242, participant_type: 'delegate', participant_order: 1 }]
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'Entry 1: this user has no application from this body.' });
        });
    });
});
