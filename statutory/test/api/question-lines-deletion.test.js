const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { QuestionLine, Question, Application } = require('../../models');

describe('Question line deletion', () => {
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

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if question line is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/question-lines/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if question line ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/NaN',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({}, event);
        const questionLine = await generator.createQuestionLine({}, event);
        await generator.createQuestion({ application_id: application.id }, questionLine);

        const otherQuestionLine = await generator.createQuestionLine({}, event);
        await generator.createQuestion({ application_id: application.id }, otherQuestionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const questionLinesCount = await QuestionLine.count();
        expect(questionLinesCount).toEqual(1); // other question line

        const questionsCount = await Question.count();
        expect(questionsCount).toEqual(1); // other question line
    });

    describe('who may delete a question line', () => {
        const remove = (event, questionLine) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each(['agora', 'epm', 'spm'])('lets a holder of global:manage_question_lines:%s alone delete one of an event of that type', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:manage_question_lines:${type}`] } });
            const event = await generator.createEvent({ type, applications: [] });
            const questionLine = await generator.createQuestionLine({}, event);

            const res = await remove(event, questionLine);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'The question line was deleted.' });
            expect(await QuestionLine.count()).toEqual(0);
        });

        test.each([
            ['the permission for another event type', ['global:manage_question_lines:epm', 'global:manage_question_lines:spm']],
            ['the permission to see question lines', ['global:see_question_lines:agora']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_plenaries:agora']]
        ])('refuses %s and deletes nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({}, event);
            const questionLine = await generator.createQuestionLine({}, event);
            await generator.createQuestion({ application_id: application.id }, questionLine);

            const res = await remove(event, questionLine);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot delete question lines.' });
            expect(await QuestionLine.count()).toEqual(1);
            expect(await Question.count()).toEqual(1);
        });

        test('refuses a member with a confirmed application, also for a line with only their own questions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({}, event);
            await generator.createQuestion({ application_id: application.id }, questionLine);

            const res = await remove(event, questionLine);

            expect(res.statusCode).toEqual(403);
            expect(await QuestionLine.count()).toEqual(1);
            expect(await Question.count()).toEqual(1);
        });
    });

    describe('what is deleted', () => {
        let event;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const remove = (questionLine) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each(['open', 'closed'])('deletes an %s question line with the questions of all its askers, and nothing else', async (status) => {
            const firstApplication = await generator.createApplication({}, event);
            const secondApplication = await generator.createApplication({}, event);
            const questionLine = await generator.createQuestionLine({ status }, event);
            await generator.createQuestion({ application_id: firstApplication.id }, questionLine);
            await generator.createQuestion({ application_id: secondApplication.id }, questionLine);

            const otherQuestionLine = await generator.createQuestionLine({}, event);
            const otherQuestion = await generator.createQuestion({ application_id: firstApplication.id }, otherQuestionLine);

            const res = await remove(questionLine);

            expect(res.statusCode).toEqual(200);
            expect((await QuestionLine.findAll()).map((line) => line.id)).toEqual([otherQuestionLine.id]);
            expect((await Question.findAll()).map((question) => question.id)).toEqual([otherQuestion.id]);
            // The applications of those who asked stay.
            expect(await Application.count()).toEqual(2);
        });

        test('answers 404 when the question line is deleted already', async () => {
            const questionLine = await generator.createQuestionLine({}, event);

            expect((await remove(questionLine)).statusCode).toEqual(200);
            const res = await remove(questionLine);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Question line is not found.' });
        });
    });
});
