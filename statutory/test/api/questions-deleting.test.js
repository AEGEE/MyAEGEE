const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

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
            uri: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/1337',
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
            uri: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/false',
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
            paid_fee: true
        }, event);

        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            uri: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
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
            paid_fee: true
        }, event);
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            uri: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
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
            paid_fee: true
        }, event);

        const questionLine = await generator.createQuestionLine({ status: 'closed' }, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const res = await request({
            uri: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
