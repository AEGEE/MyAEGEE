const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { QuestionLine } = require('../../models');

describe('Question line edition', () => {
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

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'PUT',
            body: { name: 'test' },
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
            path: '/events/' + event.id + '/question-lines/1337',
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if question line ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/NaN',
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'PUT',
            body: { name: 'test' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.name).toEqual('test');
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({}, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'PUT',
            body: { name: null },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });

    describe('who may rename a question line', () => {
        const rename = (event, questionLine, body = { name: 'New name' }) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each(['agora', 'epm', 'spm'])('lets a holder of global:manage_question_lines:%s alone rename one of an event of that type', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:manage_question_lines:${type}`] } });
            const event = await generator.createEvent({ type, applications: [] });
            const questionLine = await generator.createQuestionLine({ name: 'Old name' }, event);

            const res = await rename(event, questionLine);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: questionLine.id, event_id: event.id, name: 'New name', status: 'open' });
            expect((await QuestionLine.findByPk(questionLine.id)).name).toEqual('New name');
        });

        test.each([
            ['the permission for another event type', ['global:manage_question_lines:epm', 'global:manage_question_lines:spm']],
            ['the permission to see question lines', ['global:see_question_lines:agora']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_plenaries:agora']]
        ])('refuses %s and changes nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ name: 'Old name' }, event);

            const res = await rename(event, questionLine);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage question lines.' });
            expect((await QuestionLine.findByPk(questionLine.id)).name).toEqual('Old name');
        });

        test('refuses a member with a confirmed application and changes nothing', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ name: 'Old name' }, event);
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);

            const res = await rename(event, questionLine);

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage question lines.' });
            expect((await QuestionLine.findByPk(questionLine.id)).name).toEqual('Old name');
        });
    });

    describe('what can be changed', () => {
        let event;
        let questionLine;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            questionLine = await generator.createQuestionLine({
                name: 'Old name',
                status: 'open',
                created_at: new Date('2030-01-01T12:00:00.000Z')
            }, event);
        });

        const edit = (body) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('changes the name only: the status, the id, the event and the creation time in the body are ignored', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await edit({
                name: 'New name',
                status: 'closed',
                id: 4242,
                event_id: otherEvent.id,
                created_at: '2001-01-01T00:00:00.000Z'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: questionLine.id,
                event_id: event.id,
                name: 'New name',
                status: 'open',
                created_at: '2030-01-01T12:00:00.000Z'
            });

            expect(await QuestionLine.count()).toEqual(1);
            const questionLineFromDb = await QuestionLine.findByPk(questionLine.id);
            expect(questionLineFromDb.name).toEqual('New name');
            expect(questionLineFromDb.status).toEqual('open');
            expect(questionLineFromDb.event_id).toEqual(event.id);
            expect(questionLineFromDb.created_at.toISOString()).toEqual('2030-01-01T12:00:00.000Z');
        });

        test('renames a closed question line and leaves it closed', async () => {
            await questionLine.update({ status: 'closed' });

            const res = await edit({ name: 'New name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ name: 'New name', status: 'closed' });
        });

        test.each([
            ['an empty name', '', 'Question line name should be set.'],
            ['a name of spaces only', '   ', 'Question line name should be set.'],
            ['a list as name', ['Questions'], 'name cannot be an array or an object']
        ])('answers 422 for %s and changes nothing', async (description, name, message) => {
            const res = await edit({ name });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { name: [message] } });
            expect((await QuestionLine.findByPk(questionLine.id)).name).toEqual('Old name');
        });
    });
});
