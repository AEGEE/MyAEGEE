const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const {
    Event,
    Position,
    Plenary,
    QuestionLine,
    Question,
    MembersList,
    PaxLimit
} = require('../../models');

// The ID, the timestamps, the parent and the status of a record are set by the service.
// A request saves the fields of its form; whatever else it carries is ignored.
describe('Fields that the service sets itself', () => {
    let event;
    let otherEvent;

    const LONG_AGO = '2001-01-01T00:00:00.000Z';
    const serverSet = { id: 987654, created_at: LONG_AGO, updated_at: LONG_AGO };

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
        otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
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

    // The record was stored just now, under an ID of the service's own.
    const expectServerSet = (record) => {
        expect(record.id).not.toEqual(serverSet.id);
        expect(moment(record.created_at).isAfter(moment().subtract(1, 'minute'))).toEqual(true);
        expect(moment(record.updated_at).isAfter(moment().subtract(1, 'minute'))).toEqual(true);
    };

    describe('questions', () => {
        let questionLine;
        let otherQuestionLine;
        let application;
        let otherApplication;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
            otherApplication = await generator.createApplication({ user_id: 1337, confirmed: true }, event);
            questionLine = await generator.createQuestionLine({}, event);
            otherQuestionLine = await generator.createQuestionLine({}, event);
        });

        test('should ask a question as the applicant, in the line of the URL, now', async () => {
            const res = await send('POST', '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions', {
                ...serverSet,
                text: 'A question',
                application_id: otherApplication.id,
                question_line_id: otherQuestionLine.id
            });

            expect(res.statusCode).toEqual(200);

            const [question] = await Question.findAll();
            expectServerSet(question);
            expect(question.text).toEqual('A question');
            expect(question.application_id).toEqual(application.id);
            expect(question.question_line_id).toEqual(questionLine.id);
        });

        test('should keep the next question working after one that carried an ID', async () => {
            const path = '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions';
            const first = await send('POST', path, { text: 'First' });
            const second = await send('POST', path, { text: 'Second', id: first.body.data.id + 1 });
            const third = await send('POST', path, { text: 'Third' });

            expect([first.statusCode, second.statusCode, third.statusCode]).toEqual([200, 200, 200]);
            expect(await Question.count()).toEqual(3);
        });

        test('should only change the text when a question is edited', async () => {
            const question = await generator.createQuestion({ application_id: application.id, text: 'Before' }, questionLine);

            const res = await send('PUT', '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id, {
                ...serverSet,
                text: 'After',
                application_id: otherApplication.id,
                question_line_id: otherQuestionLine.id
            });

            expect(res.statusCode).toEqual(200);

            const questionFromDb = await Question.findByPk(question.id);
            expect(questionFromDb.text).toEqual('After');
            expect(questionFromDb.application_id).toEqual(application.id);
            expect(questionFromDb.question_line_id).toEqual(questionLine.id);
            expect(questionFromDb.created_at).toEqual(question.created_at);
        });
    });

    describe('question lines', () => {
        test('should add a question line to the event of the URL, open, now', async () => {
            const res = await send('POST', '/events/' + event.id + '/question-lines', {
                ...serverSet,
                name: 'Prytanium',
                event_id: otherEvent.id,
                status: 'closed'
            });

            expect(res.statusCode).toEqual(200);

            const [questionLine] = await QuestionLine.findAll();
            expectServerSet(questionLine);
            expect(questionLine.name).toEqual('Prytanium');
            expect(questionLine.event_id).toEqual(event.id);
            expect(questionLine.status).toEqual('open');
        });

        test('should only change the name when a question line is edited', async () => {
            const questionLine = await generator.createQuestionLine({ name: 'Before' }, event);

            const res = await send('PUT', '/events/' + event.id + '/question-lines/' + questionLine.id, {
                ...serverSet,
                name: 'After',
                event_id: otherEvent.id,
                status: 'closed'
            });

            expect(res.statusCode).toEqual(200);

            const questionLineFromDb = await QuestionLine.findByPk(questionLine.id);
            expect(questionLineFromDb.name).toEqual('After');
            expect(questionLineFromDb.event_id).toEqual(event.id);
            expect(questionLineFromDb.status).toEqual('open');
            expect(questionLineFromDb.created_at).toEqual(questionLine.created_at);
        });
    });

    describe('plenaries', () => {
        test('should add a plenary to the event of the URL, now', async () => {
            const res = await send('POST', '/events/' + event.id + '/plenaries', {
                ...serverSet,
                ...generator.generatePlenary({ name: 'Opening plenary' }),
                event_id: otherEvent.id
            });

            expect(res.statusCode).toEqual(200);

            const [plenary] = await Plenary.findAll();
            expectServerSet(plenary);
            expect(plenary.name).toEqual('Opening plenary');
            expect(plenary.event_id).toEqual(event.id);
        });

        test('should keep a plenary with its event when it is edited', async () => {
            const plenary = await generator.createPlenary({ name: 'Before' }, event);

            const res = await send('PUT', '/events/' + event.id + '/plenaries/' + plenary.id, {
                ...serverSet,
                name: 'After',
                event_id: otherEvent.id
            });

            expect(res.statusCode).toEqual(200);

            const plenaryFromDb = await Plenary.findByPk(plenary.id);
            expect(plenaryFromDb.name).toEqual('After');
            expect(plenaryFromDb.event_id).toEqual(event.id);
            expect(plenaryFromDb.created_at).toEqual(plenary.created_at);
        });
    });

    describe('positions', () => {
        const period = { starts: moment().add(1, 'week').toDate(), ends: moment().add(2, 'week').toDate() };

        test('should add a position to the event of the URL, not deleted, now', async () => {
            const res = await send('POST', '/events/' + event.id + '/positions', {
                ...serverSet,
                ...generator.generatePosition({ name: 'President', ...period }),
                event_id: otherEvent.id,
                deleted: true,
                status: 'open'
            });

            expect(res.statusCode).toEqual(200);

            const [position] = await Position.findAll();
            expectServerSet(position);
            expect(position.name).toEqual('President');
            expect(position.event_id).toEqual(event.id);
            expect(position.deleted).toEqual(false);
            // The period has not started yet.
            expect(position.status).toEqual('closed');
        });

        test('should keep a position with its event, and not delete it, when it is edited', async () => {
            const position = await generator.createPosition({ name: 'Before', ...period }, event);

            const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id, {
                ...serverSet,
                name: 'After',
                event_id: otherEvent.id,
                deleted: true,
                status: 'open'
            });

            expect(res.statusCode).toEqual(200);

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.name).toEqual('After');
            expect(positionFromDb.event_id).toEqual(event.id);
            expect(positionFromDb.deleted).toEqual(false);
            expect(positionFromDb.status).toEqual('closed');
            expect(positionFromDb.created_at).toEqual(position.created_at);
        });
    });

    describe('events', () => {
        test('should add an event as a draft, now, without what the service fills in later', async () => {
            const res = await send('POST', '/', {
                ...generator.generateEvent({ type: 'epm', name: 'New event' }),
                ...serverSet,
                status: 'published',
                publication_date: LONG_AGO,
                application_status_revealed_at: LONG_AGO,
                previous_agora_id: event.id,
                image_id: 1
            });

            expect(res.statusCode).toEqual(200);

            const created = await Event.findOne({ where: { name: 'New event' } });
            expectServerSet(created);
            expect(created.status).toEqual('draft');
            expect(created.publication_date).toEqual(null);
            expect(created.application_status_revealed_at).toEqual(null);
            expect(created.previous_agora_id).toEqual(null);
            expect(created.image_id).toEqual(null);
        });

        test('should keep the ID, the type, the status and the dates the service sets when an event is edited', async () => {
            const res = await send('PUT', '/events/' + event.id, {
                ...serverSet,
                name: 'After',
                type: 'epm',
                status: 'draft',
                publication_date: LONG_AGO,
                previous_agora_id: otherEvent.id,
                image_id: 1
            });

            expect(res.statusCode).toEqual(200);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb.name).toEqual('After');
            expect(eventFromDb.type).toEqual('agora');
            expect(eventFromDb.status).toEqual('published');
            expect(eventFromDb.publication_date).toEqual(null);
            expect(eventFromDb.previous_agora_id).toEqual(null);
            expect(eventFromDb.image_id).toEqual(null);
            expect(eventFromDb.created_at).toEqual(event.created_at);
            expect(await Event.count({ where: { id: serverSet.id } })).toEqual(0);
        });
    });

    describe('members lists', () => {
        const bodyId = regularUser.bodies[0].id;

        test('should store a members list for the event and the body of the URL, by the caller, now', async () => {
            const res = await send('POST', '/events/' + event.id + '/memberslists/' + bodyId, {
                ...serverSet,
                ...generator.generateMembersList({}),
                event_id: otherEvent.id,
                body_id: 1337,
                user_id: 1337,
                conversion_rate: 1000,
                fee_paid: 500
            });

            expect(res.statusCode).toEqual(200);

            const [memberslist] = await MembersList.findAll();
            expectServerSet(memberslist);
            expect(memberslist.event_id).toEqual(event.id);
            expect(memberslist.body_id).toEqual(bodyId);
            expect(memberslist.user_id).toEqual(regularUser.id);
            expect(Number(memberslist.conversion_rate)).toEqual(1);
            expect(Number(memberslist.fee_paid)).toEqual(0);
        });
    });

    describe('participants limits', () => {
        test('should store a limit for the event type of the URL, now', async () => {
            const res = await send('POST', '/limits/agora', {
                ...serverSet,
                ...generator.generatePaxLimit({ body_id: 34 }),
                event_type: 'epm'
            });

            expect(res.statusCode).toEqual(200);

            const [limit] = await PaxLimit.findAll();
            expectServerSet(limit);
            expect(limit.body_id).toEqual(34);
            expect(limit.event_type).toEqual('agora');
        });
    });
});
