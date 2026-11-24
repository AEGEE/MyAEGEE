const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// A request asks core once for the user, once for their permissions and once for each of
// the two lists of bodies they act for, whichever router answers it.
describe('Calls to core per request', () => {
    let paths;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);
        const plenary = await generator.createPlenary({}, event);
        const questionLine = await generator.createQuestionLine({}, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);

        const base = '/events/' + event.id;
        paths = {
            event: base,
            applications: base + '/applications/accepted',
            application: base + '/applications/' + application.id,
            memberslists: base + '/memberslists',
            votes: base + '/votes-amounts/antenna',
            positions: base + '/positions',
            candidate: base + '/positions/' + position.id + '/candidates/' + candidate.id,
            plenaries: base + '/plenaries',
            plenary: base + '/plenaries/' + plenary.id,
            questionLines: base + '/question-lines',
            question: base + '/question-lines/' + questionLine.id + '/questions/' + question.id
        };
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const userAndEventCalls = [
        'GET /members/me',
        'GET /my_permissions',
        'POST /my_permissions',
        'POST /my_permissions'
    ];

    test.each([
        ['event', []],
        ['applications', []],
        // The notification email of the applicant.
        ['application', ['GET /members_email?query=' + regularUser.id]],
        ['memberslists', []],
        ['votes', []],
        ['positions', []],
        ['candidate', []],
        ['plenaries', []],
        ['plenary', []],
        ['questionLines', []],
        ['question', []]
    ])('should ask core once for the user and the event on the %s route', async (name, others) => {
        const requests = [];
        for (const stub of Object.values(mock.mockAll())) {
            stub.on('request', (mockRequest) => {
                const url = new URL(mockRequest.url);
                requests.push(`${mockRequest.method} ${url.pathname}${url.search}`);
            });
        }

        const res = await request({
            path: paths[name],
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(requests.sort()).toEqual([...userAndEventCalls, ...others].sort());
    });

    test('should ask core once for the user on a route without an event', async () => {
        const requests = [];
        for (const stub of Object.values(mock.mockAll())) {
            stub.on('request', (mockRequest) => {
                const url = new URL(mockRequest.url);
                requests.push(`${mockRequest.method} ${url.pathname}${url.search}`);
            });
        }

        const res = await request({
            path: '/recents',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(requests.sort()).toEqual(['GET /members/me', 'GET /my_permissions']);
    });
});
