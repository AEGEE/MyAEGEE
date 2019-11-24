const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

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
            uri: '/events/' + firstEvent.id + '/question-lines/',
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

    test('should sort positions on /', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstQuestionLine = await generator.createQuestionLine({}, firstEvent);
        const secondQuestionLine = await generator.createQuestionLine({}, firstEvent);

        const res = await request({
            uri: '/events/' + firstEvent.id + '/question-lines/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(firstQuestionLine.id);
        expect(res.body.data[1].id).toEqual(secondQuestionLine.id);
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
            uri: '/events/' + firstEvent.id + '/question-lines/',
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
            uri: '/events/' + firstEvent.id + '/question-lines/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
