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
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
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
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
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
});
