const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { QuestionLine } = require('../../models');

describe('Question lines status update', () => {
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
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
            method: 'PUT',
            body: { status: 'closed' },
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
            path: '/events/' + event.id + '/question-lines/1337/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if question line ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/question-lines/NaN/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({
            status: 'open'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
            method: 'PUT',
            body: { status: 'closed' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.status).toEqual('closed');
    });

    test('should not update anything if body is empty', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({
            status: 'open'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
            method: 'PUT',
            body: {},
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.status).toEqual('open');
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({
            status: 'open'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
            method: 'PUT',
            body: { status: false },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');
    });

    test('should not affect extra fields', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({
            name: 'test'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
            method: 'PUT',
            body: {
                name: 'test new'
            },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.name).toEqual('test');
    });

    describe('who may open and close a question line', () => {
        const setStatus = (event, questionLine, status) => request({
            path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
            method: 'PUT',
            body: { status },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each([
            ['close an open', 'open', 'closed'],
            ['open a closed', 'closed', 'open'],
            ['close a closed', 'closed', 'closed']
        ])('lets a holder of global:manage_question_lines:agora alone %s question line', async (description, before, after) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ name: 'Questions to the board', status: before }, event);

            const res = await setStatus(event, questionLine, after);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: questionLine.id, name: 'Questions to the board', status: after });
            expect((await QuestionLine.findByPk(questionLine.id)).status).toEqual(after);
        });

        test.each(['epm', 'spm'])('lets a holder of global:manage_question_lines:%s alone close one of an event of that type', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:manage_question_lines:${type}`] } });
            const event = await generator.createEvent({ type, applications: [] });
            const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

            const res = await setStatus(event, questionLine, 'closed');

            expect(res.statusCode).toEqual(200);
            expect((await QuestionLine.findByPk(questionLine.id)).status).toEqual('closed');
        });

        test.each([
            ['the permission for another event type', ['global:manage_question_lines:epm', 'global:manage_question_lines:spm']],
            ['the permission to see question lines', ['global:see_question_lines:agora']],
            ['the other permissions for an Agora', ['global:manage_event:agora', 'global:manage_applications:agora', 'global:manage_plenaries:agora']]
        ])('refuses %s and changes nothing', async (description, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

            const res = await setStatus(event, questionLine, 'closed');

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage question lines.' });
            expect((await QuestionLine.findByPk(questionLine.id)).status).toEqual('open');
        });

        test('refuses a member with a confirmed application and changes nothing', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted', confirmed: true }, event);

            const res = await setStatus(event, questionLine, 'closed');

            expect(res.statusCode).toEqual(403);
            expect((await QuestionLine.findByPk(questionLine.id)).status).toEqual('open');
        });
    });

    describe('a status that is not open or closed', () => {
        // The message names a position: it was copied from the positions.
        const NOT_A_STATUS = 'Position status can be one of these: "open", "closed".';

        test.each([
            ['a status that does not exist', 'archived', NOT_A_STATUS],
            ['an empty status', '', NOT_A_STATUS],
            ['a status in capitals', 'CLOSED', NOT_A_STATUS],
            ['null', null, 'question_line.status cannot be null']
        ])('answers 422 for %s and changes nothing', async (description, status, message) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_question_lines:agora'] } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const questionLine = await generator.createQuestionLine({ status: 'open' }, event);

            const res = await request({
                path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/status',
                method: 'PUT',
                body: { status },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { status: [message] } });
            expect((await QuestionLine.findByPk(questionLine.id)).status).toEqual('open');
        });
    });
});
