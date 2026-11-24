const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// Without a permission for question lines, seeing the question lines and their questions and
// asking a question need an application to the event that is confirmed and not cancelled.
describe('Question lines for applicants', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    // An application is confirmed first and cancelled afterwards: a cancelled one cannot be confirmed.
    const createMyApplication = async (event, { cancelled, ...fields }) => {
        const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted', ...fields }, event);
        if (cancelled) {
            await application.update({ cancelled: true });
        }

        return application;
    };

    const setUp = async (applicationFields) => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const questionLine = await generator.createQuestionLine({ status: 'open' }, event);
        await createMyApplication(event, applicationFields);
        const other = await generator.createApplication({ user_id: 2, confirmed: true }, event);
        const question = await generator.createQuestion({ application_id: other.id }, questionLine);

        return { event, questionLine, question };
    };

    const list = (event) => request({
        path: '/events/' + event.id + '/question-lines',
        method: 'GET',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    const ask = (event, questionLine) => request({
        path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions',
        method: 'POST',
        body: { text: 'A question' },
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    const display = (event, questionLine, question) => request({
        path: '/events/' + event.id + '/question-lines/' + questionLine.id + '/questions/' + question.id,
        method: 'GET',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    describe('with a confirmed application that is cancelled', () => {
        test('the question lines are not listed', async () => {
            const { event } = await setUp({ confirmed: true, cancelled: true });

            const res = await list(event);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
        });

        test('a question cannot be asked', async () => {
            const { event, questionLine } = await setUp({ confirmed: true, cancelled: true });

            const res = await ask(event, questionLine);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
        });

        test('the question of another member cannot be read', async () => {
            const { event, questionLine, question } = await setUp({ confirmed: true, cancelled: true });

            const res = await display(event, questionLine, question);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
        });

        test('the event tells that the questions cannot be seen or asked', async () => {
            const { event } = await setUp({ confirmed: true, cancelled: true });

            const res = await request({
                path: '/events/' + event.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.permissions.see_questions).toEqual(false);
            expect(res.body.data.permissions.submit_questions).toEqual(false);
        });
    });

    describe('with a confirmed application', () => {
        test('the question lines are listed and a question can be asked', async () => {
            const { event, questionLine } = await setUp({ confirmed: true });

            const listed = await list(event);
            expect(listed.statusCode).toEqual(200);

            const asked = await ask(event, questionLine);
            expect(asked.statusCode).toEqual(200);
            expect(asked.body.data.text).toEqual('A question');
        });
    });
});
