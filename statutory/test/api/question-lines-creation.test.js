const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { QuestionLine } = require('../../models');

describe('Question line creation', () => {
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

    test('should fail if name is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = generator.generateQuestionLine({ name: null });

        const res = await request({
            path: '/events/' + event.id + '/question-lines/',
            method: 'POST',
            body: questionLine,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = generator.generateQuestionLine({});

        const res = await request({
            path: '/events/' + event.id + '/question-lines/',
            method: 'POST',
            body: questionLine,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = generator.generateQuestionLine({});

        const res = await request({
            path: '/events/' + event.id + '/question-lines/',
            method: 'POST',
            body: questionLine,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(questionLine.name);
        expect(res.body.data.status).toEqual('open');
    });

    describe('who may add a question line', () => {
        let event;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const create = (body, targetEvent = event) => request({
            path: '/events/' + targetEvent.id + '/question-lines',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // Question lines exist for every type of event.
        test.each(['agora', 'epm', 'spm'])('lets a holder of global:manage_question_lines:%s alone add one to an event of that type', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:manage_question_lines:${type}`] } });
            const typedEvent = await generator.createEvent({ type, applications: [] });

            const res = await create({ name: 'Questions to the board' }, typedEvent);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ event_id: typedEvent.id, name: 'Questions to the board', status: 'open' });

            const questionLines = await QuestionLine.findAll({ raw: true });
            expect(questionLines.length).toEqual(1);
            expect(questionLines[0]).toMatchObject({
                id: res.body.data.id,
                event_id: typedEvent.id,
                name: 'Questions to the board',
                status: 'open'
            });
        });

        test.each([
            ['the permission for another event type', ['global:manage_question_lines:epm', 'global:manage_question_lines:spm']],
            ['the permission to see question lines', ['global:see_question_lines:agora']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_plenaries:agora']]
        ])('refuses %s and stores nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await create({ name: 'Questions to the board' });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage question lines.' });
            expect(await QuestionLine.count()).toEqual(0);
        });

        test('refuses a member with a confirmed application and stores nothing', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);

            const res = await create({ name: 'Questions to the board' });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage question lines.' });
            expect(await QuestionLine.count()).toEqual(0);
        });
    });

    describe('what is stored', () => {
        let event;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const create = (body) => request({
            path: '/events/' + event.id + '/question-lines',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('opens the new question line for the event in the URL, whatever status and event the body names', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await create({ name: 'Questions to the board', status: 'closed', event_id: otherEvent.id });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('open');
            expect(res.body.data.event_id).toEqual(event.id);

            const questionLine = await QuestionLine.findByPk(res.body.data.id);
            expect(questionLine.status).toEqual('open');
            expect(questionLine.event_id).toEqual(event.id);
        });

        test.each([
            ['an empty name', '', 'Question line name should be set.'],
            ['a name of spaces only', '   ', 'Question line name should be set.'],
            ['a list as name', ['Questions'], ['name cannot be an array or an object', 'The value should be a text.']]
        ])('answers 422 for %s and stores nothing', async (description, name, message) => {
            const res = await create({ name });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { name: [].concat(message) } });
            expect(await QuestionLine.count()).toEqual(0);
        });
    });
});
