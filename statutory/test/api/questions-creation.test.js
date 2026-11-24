const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Question } = require('../../models');

describe('Questions creation', () => {
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

    test('should succeed if the user applied and is confirmed', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        await generator.createApplication({
            user_id: regularUser.id,
            confirmed: true
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
            method: 'POST',
            body: { text: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should fail if the user haven\'t applied', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
            method: 'POST',
            body: { text: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if the question line is closed', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
        await generator.createApplication({
            user_id: regularUser.id,
            confirmed: true
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
            method: 'POST',
            body: { text: 'test' },
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
            path: '/events/' + event.id + '/question-lines/1337/questions',
            method: 'POST',
            body: { text: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if question line ID is NaN', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/question-lines/false/questions',
            method: 'POST',
            body: { text: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if text is not set', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        await generator.createApplication({
            user_id: regularUser.id,
            confirmed: true
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
            method: 'POST',
            body: { text: null },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('text');
    });

    describe('who may ask a question', () => {
        const NOT_ALLOWED = { success: false, message: 'You cannot submit a question.' };
        let event;
        let questionLine;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        });

        const ask = (body = { text: 'What about the budget?' }, targetEvent = event, line = questionLine) => request({
            path: '/events/' + targetEvent.id + '/question-lines/' + line.id + '/questions',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('lets a member with a confirmed application and no permission ask, for their own application', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            await generator.createApplication({ status: 'accepted', confirmed: true }, event);

            const res = await ask();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                text: 'What about the budget?',
                application_id: application.id,
                question_line_id: questionLine.id
            });

            const questions = await Question.findAll({ raw: true });
            expect(questions.length).toEqual(1);
            expect(questions[0]).toMatchObject({
                id: res.body.data.id,
                text: 'What about the budget?',
                application_id: application.id,
                question_line_id: questionLine.id
            });
        });

        // Question lines exist for every type of event.
        test.each(['epm', 'spm'])('lets a member with a confirmed application ask in a question line of an %s event', async (type) => {
            const typedEvent = await generator.createEvent({ type, applications: [] });
            const typedQuestionLine = await generator.createQuestionLine({ status: 'open' }, typedEvent);
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, typedEvent);

            const res = await ask({ text: 'What about the budget?' }, typedEvent, typedQuestionLine);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_id).toEqual(application.id);
            expect(await Question.count({ where: { question_line_id: typedQuestionLine.id } })).toEqual(1);
        });

        test('lets a member ask more than one question in a question line', async () => {
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);

            expect((await ask({ text: 'First question' })).statusCode).toEqual(200);
            expect((await ask({ text: 'Second question' })).statusCode).toEqual(200);

            const questions = await Question.findAll({ order: [['id', 'ASC']] });
            expect(questions.map((question) => question.text)).toEqual(['First question', 'Second question']);
        });

        test.each([
            ['who manages question lines', ['global:manage_question_lines:agora']],
            ['who may see question lines', ['global:see_question_lines:agora']]
        ])('refuses somebody %s but has no application, and stores nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await ask();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(NOT_ALLOWED);
            expect(await Question.count()).toEqual(0);
        });

        test('refuses a member whose application to the event is not confirmed, and stores nothing', async () => {
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: false }, event);

            const res = await ask();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(NOT_ALLOWED);
            expect(await Question.count()).toEqual(0);
        });

        test('refuses a member whose confirmed application is to another event, and stores nothing', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, otherEvent);

            const res = await ask();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(NOT_ALLOWED);
            expect(await Question.count()).toEqual(0);
        });

        test('refuses everybody once the question line is closed, also who manages question lines', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            await questionLine.update({ status: 'closed' });

            const res = await ask();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'The question line is closed, you cannot ask questions now.' });
            expect(await Question.count()).toEqual(0);
        });

        // As for a member without an application.
        test('refuses a member whose confirmed application was cancelled', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            await application.update({ cancelled: true });

            const res = await ask();

            expect(res.statusCode).toEqual(403);
            expect(await Question.count({ where: { application_id: application.id } })).toEqual(0);
        });
    });

    describe('what is stored', () => {
        let event;
        let questionLine;
        let application;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            questionLine = await generator.createQuestionLine({ status: 'open' }, event);
            application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
        });

        const ask = (body) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('stores the question for the caller and the question line in the URL, whatever application and line the body names', async () => {
            const otherApplication = await generator.createApplication({ status: 'accepted', confirmed: true }, event);
            const otherQuestionLine = await generator.createQuestionLine({ status: 'open' }, event);

            const res = await ask({
                text: 'What about the budget?',
                application_id: otherApplication.id,
                question_line_id: otherQuestionLine.id,
                status: 'closed'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_id).toEqual(application.id);
            expect(res.body.data.question_line_id).toEqual(questionLine.id);

            const question = await Question.findByPk(res.body.data.id);
            expect(question.application_id).toEqual(application.id);
            expect(question.question_line_id).toEqual(questionLine.id);
            expect(await Question.count()).toEqual(1);
        });

        test.each([
            ['an empty text', '', 'Question text should be set.'],
            ['a text of spaces only', '   ', 'Question text should be set.'],
            ['a list as text', ['What about the budget?'], ['text cannot be an array or an object', 'The value should be a text.']]
        ])('answers 422 for %s and stores nothing', async (description, text, message) => {
            const res = await ask({ text });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { text: [].concat(message) } });
            expect(await Question.count()).toEqual(0);
        });
    });
});
