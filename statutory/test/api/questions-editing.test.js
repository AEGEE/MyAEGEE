const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Question } = require('../../models');

describe('Questions editing', () => {
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

    test('should return 403 if the question line is closed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: regularUser.id,
            confirmed: true
        }, event);

        const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if question is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/1337',
            method: 'PUT',
            body: { first_name: 'Different' },
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
            method: 'PUT',
            body: { text: 'new' },
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
            method: 'PUT',
            body: { text: 'test' },
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
            method: 'PUT',
            body: { text: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should return 403 when trying to edit other user\'s question', async () => {
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
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('in a closed question line', () => {
        test('should not let the author edit the question', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
            const question = await generator.createQuestion({ application_id: application.id, text: 'Original' }, questionLine);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'PUT',
                body: { text: 'Changed' },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('The question line is closed, you cannot edit questions now.');

            const questionFromDb = await Question.findByPk(question.id);
            expect(questionFromDb.text).toEqual('Original');
        });

        test('should let a question lines manager edit the question', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 1337, confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
            const question = await generator.createQuestion({ application_id: application.id, text: 'Original' }, questionLine);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'PUT',
                body: { text: 'Changed' },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.text).toEqual('Changed');

            const questionFromDb = await Question.findByPk(question.id);
            expect(questionFromDb.text).toEqual('Changed');
        });

        test('should not let a question lines manager of another event type edit the question', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:epm'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ user_id: 1337, confirmed: true }, event);
            const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
            const question = await generator.createQuestion({ application_id: application.id, text: 'Original' }, questionLine);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
                method: 'PUT',
                body: { text: 'Changed' },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);

            const questionFromDb = await Question.findByPk(question.id);
            expect(questionFromDb.text).toEqual('Original');
        });
    });

    describe('who may edit a question in an open question line', () => {
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

        const edit = (question, body = { text: 'Changed' }) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('lets the member who asked it edit it, and answers with the stored question and their application', async () => {
            const res = await edit(myQuestion);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: myQuestion.id,
                question_line_id: questionLine.id,
                application_id: myApplication.id,
                text: 'Changed'
            });
            expect(res.body.data.application.id).toEqual(myApplication.id);
            expect(res.body.data.application.user_id).toEqual(regularUser.id);

            expect((await Question.findByPk(myQuestion.id)).text).toEqual('Changed');
            expect((await Question.findByPk(theirQuestion.id)).text).toEqual('Their question');
        });

        test('lets a holder of global:manage_question_lines:agora alone edit the question of somebody else', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });

            const res = await edit(theirQuestion);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.text).toEqual('Changed');
            // The question stays the question of the member who asked it.
            expect(res.body.data.application_id).toEqual(theirApplication.id);
            expect((await Question.findByPk(theirQuestion.id)).text).toEqual('Changed');
        });

        test.each([
            ['another member with a confirmed application', []],
            ['the permission to see question lines', ['global:see_question_lines:agora']],
            ['the permissions for another event type', ['global:manage_question_lines:epm', 'global:see_question_lines:epm', 'global:manage_question_lines:spm', 'global:see_question_lines:spm']]
        ])('refuses %s for the question of somebody else, and changes nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await edit(theirQuestion);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot edit this question.' });
            expect((await Question.findByPk(theirQuestion.id)).text).toEqual('Their question');
        });

        test('lets the member who asked it edit it when their application is not confirmed any more', async () => {
            await myApplication.update({ confirmed: false });

            const res = await edit(myQuestion);

            expect(res.statusCode).toEqual(200);
            expect((await Question.findByPk(myQuestion.id)).text).toEqual('Changed');
        });
    });

    describe('what can be changed', () => {
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

        const edit = (body) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + myQuestion.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('changes the text only: the application, the question line, the id and the creation time in the body are ignored', async () => {
            const otherQuestionLine = await generator.createQuestionLine({ status: 'open' }, event);
            const createdAt = (await Question.findByPk(myQuestion.id)).created_at;

            const res = await edit({
                text: 'Changed',
                application_id: theirApplication.id,
                question_line_id: otherQuestionLine.id,
                id: 4242,
                created_at: '2001-01-01T00:00:00.000Z',
                status: 'closed'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: myQuestion.id,
                question_line_id: questionLine.id,
                application_id: myApplication.id,
                text: 'Changed',
                created_at: createdAt.toISOString()
            });

            expect(await Question.count()).toEqual(2);
            const questionFromDb = await Question.findByPk(myQuestion.id);
            expect(questionFromDb.text).toEqual('Changed');
            expect(questionFromDb.application_id).toEqual(myApplication.id);
            expect(questionFromDb.question_line_id).toEqual(questionLine.id);
            expect(questionFromDb.created_at).toEqual(createdAt);
            expect((await Question.findByPk(theirQuestion.id)).text).toEqual('Their question');
        });

        test.each([
            ['an empty text', '', 'Question text should be set.'],
            ['a text of spaces only', '   ', 'Question text should be set.'],
            ['no text (null)', null, 'question.text cannot be null'],
            ['a list as text', ['Changed'], ['text cannot be an array or an object', 'The value should be a text.']]
        ])('answers 422 for %s and changes nothing', async (description, text, message) => {
            const res = await edit({ text });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { text: [].concat(message) } });
            expect((await Question.findByPk(myQuestion.id)).text).toEqual('My question');
        });
    });
});
