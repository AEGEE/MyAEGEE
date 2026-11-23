const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Question } = require('../../models');

describe('Questions deleting', () => {
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
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return 404 if question is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if question ID is NaN', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/false',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything is okay', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: regularUser.id,
            confirmed: true
        }, event);

        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'Question is deleted.' });
    });

    test('should succeed if you have the global permission', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: 1337,
            confirmed: true
        }, event);
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'Question is deleted.' });
    });

    test('should return 403 when trying to delete other user\'s question', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: 1337,
            confirmed: true
        }, event);

        const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('in a closed question line', () => {
        test('should not let the author delete the question', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
            const question = await generator.createQuestion({ application_id: application.id }, questionLine);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('The question line is closed, you cannot delete questions now.');
            expect(await Question.count({ where: { id: question.id } })).toEqual(1);
        });

        test('should let a question lines manager delete the question', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 1337, confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
            const question = await generator.createQuestion({ application_id: application.id }, questionLine);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(await Question.count({ where: { id: question.id } })).toEqual(0);
        });
    });

    describe('who may delete a question in an open question line', () => {
        let event;
        let questionLine;
        let myApplication;
        let theirApplication;
        let myQuestion;
        let theirQuestion;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            questionLine = await generator.createQuestionLine({ status: 'open' }, event);
            myApplication = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            theirApplication = await generator.createApplication({ status: 'accepted', confirmed: true }, event);
            myQuestion = await generator.createQuestion({ application_id: myApplication.id, text: 'My question' }, questionLine);
            theirQuestion = await generator.createQuestion({ application_id: theirApplication.id, text: 'Their question' }, questionLine);
        });

        const remove = (question) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const questionIds = async () => (await Question.findAll({ order: [['id', 'ASC']] })).map((question) => question.id);

        test('lets the member who asked it delete it, and leaves the other questions', async () => {
            const res = await remove(myQuestion);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'Question is deleted.' });
            expect(await questionIds()).toEqual([theirQuestion.id]);
        });

        test('lets a holder of global:manage_question_lines:agora alone delete the question of somebody else', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });

            const res = await remove(theirQuestion);

            expect(res.statusCode).toEqual(200);
            expect(await questionIds()).toEqual([myQuestion.id]);
        });

        test.each([
            ['another member with a confirmed application', []],
            ['the permission to see question lines', ['global:see_question_lines:agora']],
            ['the permissions for another event type', ['global:manage_question_lines:epm', 'global:see_question_lines:epm', 'global:manage_question_lines:spm', 'global:see_question_lines:spm']]
        ])('refuses %s for the question of somebody else, and deletes nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await remove(theirQuestion);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot delete this question.' });
            expect(await questionIds()).toEqual([myQuestion.id, theirQuestion.id]);
        });

        test('lets the member who asked it delete it when their application is not confirmed any more', async () => {
            await myApplication.update({ confirmed: false });

            const res = await remove(myQuestion);

            expect(res.statusCode).toEqual(200);
            expect(await questionIds()).toEqual([theirQuestion.id]);
        });

        test('answers 404 when the question is deleted already', async () => {
            expect((await remove(myQuestion)).statusCode).toEqual(200);

            const res = await remove(myQuestion);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Question is not found.' });
        });
    });
});
