const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Question lines listing', () => {
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

    test('should list all of the question lines for this event', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstQuestionLine = await generator.createQuestionLine({}, firstEvent);

        const secondEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, secondEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/question-lines/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstQuestionLine.id);
    });

    test('should list the question lines and the questions of a line in the order they were created', async () => {
        // Explicit creation times, a minute apart and against the order of the ids:
        // the route sorts by creation time, and rows made right after each other can share a millisecond.
        const at = (minute) => new Date(Date.UTC(2030, 0, 1, 12, minute));

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({}, event);
        const secondQuestionLine = await generator.createQuestionLine({ created_at: at(2) }, event);
        const firstQuestionLine = await generator.createQuestionLine({ created_at: at(1) }, event);
        const thirdQuestionLine = await generator.createQuestionLine({ created_at: at(3) }, event);

        const thirdQuestion = await generator.createQuestion({ application_id: application.id, created_at: at(6) }, firstQuestionLine);
        const firstQuestion = await generator.createQuestion({ application_id: application.id, created_at: at(4) }, firstQuestionLine);
        const secondQuestion = await generator.createQuestion({ application_id: application.id, created_at: at(5) }, firstQuestionLine);
        const otherLineQuestion = await generator.createQuestion({ application_id: application.id, created_at: at(0) }, thirdQuestionLine);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.map((line) => line.id)).toEqual([firstQuestionLine.id, secondQuestionLine.id, thirdQuestionLine.id]);
        expect(res.body.data[0].questions.map((question) => question.id)).toEqual([firstQuestion.id, secondQuestion.id, thirdQuestion.id]);
        expect(res.body.data[1].questions).toEqual([]);
        expect(res.body.data[2].questions.map((question) => question.id)).toEqual([otherLineQuestion.id]);
    });

    test('should succeed if the user doesn\'t have permissions, but applied and is confirmed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, firstEvent);

        const secondEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, secondEvent);

        await generator.createApplication({
            user_id: regularUser.id,
            status: 'accepted',
            confirmed: true
        }, firstEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/question-lines/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should fail if the user doesn\'t have permissions and not applied', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, firstEvent);

        const secondEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, secondEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/question-lines/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('who may see the question lines', () => {
        const FORBIDDEN = { success: false, message: 'You are not allowed to see questions' };
        let event;
        let questionLine;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
            questionLine = await generator.createQuestionLine({ name: 'Questions to the board' }, event);
        });

        const list = (targetEvent = event) => request({
            path: '/events/' + targetEvent.id + '/question-lines',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each([
            'global:manage_question_lines:agora',
            'global:see_question_lines:agora'
        ])('lets a holder of %s alone, without an application, see them', async (permission) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const res = await list();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((line) => line.id)).toEqual([questionLine.id]);
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
                        'global:manage_applications:agora',
                        'global:manage_plenaries:agora',
                        'global:see_plenaries:agora'
                    ]
                }
            });

            const res = await list();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(FORBIDDEN);
        });

        test('refuses a member whose application to the event is not confirmed', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: false }, event);

            const res = await list();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(FORBIDDEN);
        });

        test('refuses a member whose confirmed application is to another event', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, otherEvent);

            const res = await list();

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual(FORBIDDEN);
        });

        // BUG: an application that was confirmed and then cancelled keeps `confirmed`, and only
        // `confirmed` is looked at. Expected: 403, as for a member without an application.
        test('lets a member whose confirmed application was cancelled see them', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);
            await application.update({ cancelled: true });

            const res = await list();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((line) => line.id)).toEqual([questionLine.id]);
        });
    });

    describe('what the list holds', () => {
        test('gives each question with the name, the body and the participant type of the member who asked it', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:see_question_lines:agora'] } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ name: 'Questions to the board', status: 'closed' }, event);
            const application = await generator.createApplication({
                first_name: 'Asker',
                last_name: 'Example',
                body_name: 'Example body',
                participant_type: 'delegate',
                participant_order: 2
            }, event);
            const question = await generator.createQuestion({ application_id: application.id, text: 'What about the budget?' }, questionLine);

            const res = await request({
                path: '/events/' + event.id + '/question-lines',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0]).toMatchObject({
                id: questionLine.id,
                event_id: event.id,
                name: 'Questions to the board',
                status: 'closed'
            });
            expect(res.body.data[0].questions.length).toEqual(1);
            expect(res.body.data[0].questions[0]).toMatchObject({
                id: question.id,
                question_line_id: questionLine.id,
                application_id: application.id,
                text: 'What about the budget?'
            });
            // Nothing else of the application: no email, no answers, no board comment.
            expect(res.body.data[0].questions[0].application).toEqual({
                id: application.id,
                statutory_id: application.statutory_id,
                user_id: application.user_id,
                first_name: 'Asker',
                last_name: 'Example',
                participant_type: 'delegate',
                participant_order: 2,
                body_id: application.body_id,
                body_name: 'Example body'
            });
        });

        test('answers with an empty list for an event without question lines', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createQuestionLine({}, otherEvent);

            const res = await request({
                path: '/events/' + event.id + '/question-lines',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, data: [] });
        });

        // Question lines are not only for the Agora: unlike the plenaries and the positions,
        // these routes do not look at the type of the event.
        test.each(['agora', 'epm', 'spm'])('lists the question lines of an %s event', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:see_question_lines:${type}`] } });
            const event = await generator.createEvent({ type, applications: [] });
            const questionLine = await generator.createQuestionLine({}, event);

            const res = await request({
                path: '/events/' + event.id + '/question-lines',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((line) => line.id)).toEqual([questionLine.id]);
        });
    });
});
