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
});
