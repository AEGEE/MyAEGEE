const path = require('path');
const { rimraf } = require('rimraf');

const config = require('../../config');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const {
    Plenary,
    Position,
    Candidate,
    QuestionLine,
    Question,
    Attendance
} = require('../../models');

// Plenaries, positions, candidates, question lines and questions are only reachable
// through the event (and the position or question line) they belong to.
describe('Nested resources belong to the event in the URL', () => {
    let event;
    let otherEvent;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({ type: 'agora', applications: [] });
        otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const expectNotFound = (res, message) => {
        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(message);
        expect(res.body).not.toHaveProperty('data');
    };

    describe('plenaries', () => {
        let plenary;

        beforeEach(async () => {
            plenary = await generator.createPlenary({ name: 'Opening plenary' }, otherEvent);
        });

        test('should not edit a plenary of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/plenaries/' + plenary.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'Changed' }
            });

            expectNotFound(res, 'Plenary is not found.');

            const plenaryFromDb = await Plenary.findByPk(plenary.id);
            expect(plenaryFromDb.name).toEqual('Opening plenary');
        });

        test('should not display a plenary of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/plenaries/' + plenary.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Plenary is not found.');
        });

        test('should not mark attendance on a plenary of another event', async () => {
            const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);

            const res = await request({
                path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { application_id: application.id }
            });

            expectNotFound(res, 'Plenary is not found.');
            expect(await Attendance.count()).toEqual(0);
        });
    });

    describe('positions', () => {
        let position;

        beforeEach(async () => {
            position = await generator.createPosition({ name: 'President' }, otherEvent);
        });

        test('should not edit a position of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'Changed' }
            });

            expectNotFound(res, 'Position is not found.');

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.name).toEqual('President');
        });

        test('should not change the status of a position of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'closed' }
            });

            expectNotFound(res, 'Position is not found.');

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.status).toEqual('open');
        });

        test('should not delete a position of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Position is not found.');

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.deleted).toEqual(false);
        });

        test('should not accept a candidature for a position of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateCandidate({ body_id: regularUser.bodies[0].id })
            });

            expectNotFound(res, 'Position is not found.');
            expect(await Candidate.count()).toEqual(0);
        });
    });

    describe('candidates', () => {
        let position;
        let otherPosition;
        let candidate;

        beforeEach(async () => {
            // The other position is in the same event: the candidate has to belong to the position as well.
            position = await generator.createPosition({}, event);
            otherPosition = await generator.createPosition({}, event);
            candidate = await generator.createCandidate({ user_id: regularUser.id, first_name: 'Original' }, otherPosition);
        });

        test('should not display a candidate of another position', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Candidate is not found.');
        });

        test('should not edit a candidate of another position', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { first_name: 'Changed' }
            });

            expectNotFound(res, 'Candidate is not found.');

            const candidateFromDb = await Candidate.findByPk(candidate.id);
            expect(candidateFromDb.first_name).toEqual('Original');
        });

        test('should not change the status of a candidate of another position', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'approved' }
            });

            expectNotFound(res, 'Candidate is not found.');

            const candidateFromDb = await Candidate.findByPk(candidate.id);
            expect(candidateFromDb.status).toEqual('pending');
        });

        test('should not store an image for a candidate of another position', async () => {
            const res = await request({
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/image',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                files: { image: { path: path.join(__dirname, '..', 'assets', 'valid_image.png') } }
            });

            expectNotFound(res, 'Candidate is not found.');

            const candidateFromDb = await Candidate.findByPk(candidate.id);
            await rimraf(config.images_dir);
            expect(candidateFromDb.image_id).toEqual(null);
        });

        test('should not display a candidate through a position of another event', async () => {
            const res = await request({
                path: '/events/' + otherEvent.id + '/positions/' + otherPosition.id + '/candidates/' + candidate.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Position is not found.');
        });
    });

    describe('question lines', () => {
        let questionLine;

        beforeEach(async () => {
            questionLine = await generator.createQuestionLine({ name: 'Prytanium' }, otherEvent);
        });

        test('should not edit a question line of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'Changed' }
            });

            expectNotFound(res, 'Question line is not found.');

            const questionLineFromDb = await QuestionLine.findByPk(questionLine.id);
            expect(questionLineFromDb.name).toEqual('Prytanium');
        });

        test('should not change the status of a question line of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { status: 'closed' }
            });

            expectNotFound(res, 'Question line is not found.');

            const questionLineFromDb = await QuestionLine.findByPk(questionLine.id);
            expect(questionLineFromDb.status).toEqual('open');
        });

        test('should not delete a question line of another event', async () => {
            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Question line is not found.');
            expect(await QuestionLine.count({ where: { id: questionLine.id } })).toEqual(1);
        });

        test('should not accept a question for a question line of another event', async () => {
            await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { text: 'A question' }
            });

            expectNotFound(res, 'Question line is not found.');
            expect(await Question.count()).toEqual(0);
        });

        test('should not edit a question line of an event type the permission is not for', async () => {
            // The permission is for EPM question lines, the question line belongs to an Agora.
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:epm'] } });
            const epm = await generator.createEvent({ type: 'epm', applications: [] });

            const res = await request({
                path: '/events/' + epm.id + '/question-lines/' + questionLine.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'Changed' }
            });

            expectNotFound(res, 'Question line is not found.');

            const questionLineFromDb = await QuestionLine.findByPk(questionLine.id);
            expect(questionLineFromDb.name).toEqual('Prytanium');
        });
    });

    describe('questions', () => {
        let questionLine;
        let otherQuestionLine;
        let question;

        beforeEach(async () => {
            // The other question line is in the same event: the question has to belong to the line as well.
            const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
            questionLine = await generator.createQuestionLine({ status: 'open' }, event);
            otherQuestionLine = await generator.createQuestionLine({ status: 'closed' }, event);
            question = await generator.createQuestion({ application_id: application.id, text: 'Original' }, otherQuestionLine);
        });

        test('should not display a question of another question line', async () => {
            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Question is not found.');
        });

        test('should not edit a question of another question line', async () => {
            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { text: 'Changed' }
            });

            expectNotFound(res, 'Question is not found.');

            const questionFromDb = await Question.findByPk(question.id);
            expect(questionFromDb.text).toEqual('Original');
        });

        test('should not delete a question of another question line', async () => {
            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Question is not found.');
            expect(await Question.count({ where: { id: question.id } })).toEqual(1);
        });

        test('should not display a question through a question line of another event', async () => {
            const res = await request({
                path: '/events/' + otherEvent.id + '/question-lines/' + otherQuestionLine.id + '/questions/' + question.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectNotFound(res, 'Question line is not found.');
        });
    });
});
