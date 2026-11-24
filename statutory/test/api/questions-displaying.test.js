const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Questions displaying', () => {
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
        const questionLine = await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/1337',
            method: 'GET',
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
        const questionLine = await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/false',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything is okay and have global permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({
            user_id: 1337,
            confirmed: true
        }, event);

        const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should succeed if everything is okay and I have applied', async () => {
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
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should return 403 if no permissions', async () => {
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
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('who may see a question', () => {
        const NOT_ALLOWED = { success: false, message: 'You cannot see this question.' };
        let event;
        let questionLine;
        let asker;
        let question;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            questionLine = await generator.createQuestionLine({ status: 'open' }, event);
            asker = await generator.createApplication({
                status: 'accepted',
                confirmed: true,
                first_name: 'Asker',
                last_name: 'Example',
                body_name: 'Example body',
                participant_type: 'delegate',
                participant_order: 2
            }, event);
            question = await generator.createQuestion({ application_id: asker.id, text: 'What about the budget?' }, questionLine);
        });

        const show = (targetEvent = event, line = questionLine, target = question) => request({
            path: '/events/' + targetEvent.id + '/question-lines/' + line.id + '/questions/' + target.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each([
            'global:manage_question_lines:agora',
            'global:see_question_lines:agora'
        ])('lets a holder of %s alone, without an application, see it with a few fields of its asker', async (permission) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const res = await show();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: question.id,
                question_line_id: questionLine.id,
                application_id: asker.id,
                text: 'What about the budget?'
            });
            // Nothing else of the application: no email, no answers, no board comment.
            expect(res.body.data.application).toEqual({
                id: asker.id,
                statutory_id: asker.statutory_id,
                user_id: asker.user_id,
                first_name: 'Asker',
                last_name: 'Example',
                participant_type: 'delegate',
                participant_order: 2,
                body_id: asker.body_id,
                body_name: 'Example body'
            });
        });

        test('lets a member with a confirmed application see the question of somebody else', async () => {
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);

            const res = await show();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(question.id);
            expect(res.body.data.application.id).toEqual(asker.id);
        });

        test.each(['epm', 'spm'])('lets a holder of global:see_question_lines:%s alone see a question of an event of that type', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:see_question_lines:${type}`] } });
            const typedEvent = await generator.createEvent({ type, applications: [] });
            const typedQuestionLine = await generator.createQuestionLine({}, typedEvent);
            const typedAsker = await generator.createApplication({}, typedEvent);
            const typedQuestion = await generator.createQuestion({ application_id: typedAsker.id }, typedQuestionLine);

            const res = await show(typedEvent, typedQuestionLine, typedQuestion);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(typedQuestion.id);
        });

        test('refuses the permissions for another event type and the other permissions for an Agora', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:manage_question_lines:epm',
                        'global:see_question_lines:epm',
                        'global:manage_question_lines:spm',
                        'global:see_question_lines:spm',
                        'global:manage_event:agora',
                        'global:manage_applications:agora'
                    ]
                }
            });

            const res = await show();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(NOT_ALLOWED);
        });

        test('refuses a member whose application to the event is not confirmed', async () => {
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: false }, event);

            const res = await show();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(NOT_ALLOWED);
        });

        test('refuses a member whose confirmed application is to another event', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, otherEvent);

            const res = await show();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(NOT_ALLOWED);
        });

        // As they can edit and delete it.
        test('lets the member who asked the question read it once their application is not confirmed any more', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            const ownQuestion = await generator.createQuestion({ application_id: application.id }, questionLine);
            await application.update({ confirmed: false });

            const res = await show(event, questionLine, ownQuestion);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(ownQuestion.id);
        });
    });
});
