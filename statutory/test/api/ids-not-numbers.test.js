const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// An ID in the path is a whole number written in digits. Anything else answers 400,
// before anything is looked up.
describe('IDs in the path that are not whole numbers', () => {
    let ids;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);
        const questionLine = await generator.createQuestionLine({}, event);
        await generator.createQuestion({ application_id: application.id }, questionLine);
        await generator.createPlenary({}, event);

        ids = { event: event.id, position: position.id, candidate: candidate.id, questionLine: questionLine.id };
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const e = '/events/:event';
    const routes = [
        ['PUT', e + '/positions/:bad'],
        ['DELETE', e + '/positions/:bad'],
        ['PUT', e + '/positions/:bad/status'],
        ['POST', e + '/positions/:bad/candidates'],
        ['GET', e + '/positions/:position/candidates/:bad'],
        ['PUT', e + '/positions/:position/candidates/:bad'],
        ['PUT', e + '/positions/:position/candidates/:bad/status'],
        ['POST', e + '/positions/:position/candidates/:bad/image'],
        ['GET', e + '/plenaries/:bad'],
        ['PUT', e + '/plenaries/:bad'],
        ['POST', e + '/plenaries/:bad/attendance/mark'],
        ['PUT', e + '/question-lines/:bad'],
        ['PUT', e + '/question-lines/:bad/status'],
        ['DELETE', e + '/question-lines/:bad'],
        ['POST', e + '/question-lines/:bad/questions'],
        ['GET', e + '/question-lines/:questionLine/questions/:bad'],
        ['PUT', e + '/question-lines/:questionLine/questions/:bad'],
        ['DELETE', e + '/question-lines/:questionLine/questions/:bad'],
        ['GET', e + '/votes-amounts/:bad'],
        ['GET', e + '/applications/boardview/:bad'],
        ['POST', e + '/applications/boardview/:bad'],
        ['GET', e + '/memberslists/:bad'],
        ['POST', e + '/memberslists/:bad'],
        ['PUT', e + '/memberslists/:bad/fee_paid'],
        ['DELETE', '/limits/agora/:bad']
    ];
    const values = ['Infinity', '1e3', '1.5', '12abc', '0x10', '-1', '2147483648'];

    describe.each(routes)('%s %s', (method, template) => {
        test.each(values)('should answer 400 for %s', async (value) => {
            const path = template
                .replace(':bad', value)
                .replace(/:(\w+)/g, (match, name) => ids[name]);

            const res = await request({
                path,
                method,
                headers: { 'X-Auth-Token': 'blablabla' },
                body: method === 'POST' && path.includes('boardview') ? [] : undefined
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
            expect(res.body).not.toHaveProperty('data');
        });
    });

    // An event is found by its ID or by its URL, so anything that is not an ID is a URL.
    test.each(values)('should answer 404 for the event %s', async (value) => {
        const res = await request({
            path: '/events/' + value,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'Event with such url or ID is not found.' });
    });

    // The URL of an event is matched as it is written, in any case.
    test.each(['%25', '_____', 'my-agor_', 'my-%25'])('should not take %s as a pattern for the URL of an event', async (value) => {
        await generator.createEvent({ type: 'epm', url: 'my-agora', applications: [] });

        const res = await request({
            path: '/events/' + value,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
    });

    test('should find an event by its URL in any case', async () => {
        const event = await generator.createEvent({ type: 'epm', url: 'my-agora', applications: [] });

        const res = await request({
            path: '/events/My-Agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(event.id);
    });
});
