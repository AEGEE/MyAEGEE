const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// A request that should carry a JSON body and has none is treated as one with an empty
// object: the route answers as it does for missing fields, and never with a 500.
describe('Requests without a body', () => {
    let event;
    let ids;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 1,
            confirmed: true
        }, event);
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);
        const plenary = await generator.createPlenary({}, event);
        const questionLine = await generator.createQuestionLine({}, event);
        const question = await generator.createQuestion({ application_id: application.id }, questionLine);
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

        ids = {
            event: event.id,
            application: application.id,
            body: regularUser.bodies[0].id,
            position: position.id,
            candidate: candidate.id,
            plenary: plenary.id,
            questionLine: questionLine.id,
            question: question.id
        };
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const e = '/events/:event';
    const a = e + '/applications/:application';

    // [method, path, status]: what the route answers when nothing is sent.
    test.each([
        ['POST', '/', 403],
        ['POST', '/limits/agora', 422],
        ['PUT', e, 200],
        ['PUT', e + '/status', 400],
        ['POST', e + '/applications', 403],
        ['POST', e + '/applications/boardview/:body', 400],
        ['PUT', a, 200],
        ['PUT', a + '/cancel', 200],
        ['PUT', a + '/attended', 200],
        ['PUT', a + '/registered', 200],
        ['PUT', a + '/departed', 200],
        ['PUT', a + '/confirmed', 200],
        ['PUT', a + '/incoming', 200],
        ['PUT', a + '/is_on_memberslist', 200],
        ['PUT', a + '/status', 200],
        ['PUT', a + '/board', 200],
        // The body has a members list already, which stays as it is.
        ['POST', e + '/memberslists/:body', 200],
        ['PUT', e + '/memberslists/:body/fee_paid', 200],
        ['POST', e + '/massmailer', 400],
        ['POST', e + '/positions', 422],
        ['PUT', e + '/positions/:position', 200],
        ['PUT', e + '/positions/:position/status', 200],
        ['POST', e + '/positions/:position/candidates', 403],
        ['PUT', e + '/positions/:position/candidates/:candidate', 200],
        ['PUT', e + '/positions/:position/candidates/:candidate/status', 200],
        ['POST', e + '/question-lines', 422],
        ['PUT', e + '/question-lines/:questionLine', 200],
        ['PUT', e + '/question-lines/:questionLine/status', 200],
        ['POST', e + '/question-lines/:questionLine/questions', 422],
        ['PUT', e + '/question-lines/:questionLine/questions/:question', 200],
        ['POST', e + '/plenaries', 422],
        ['PUT', e + '/plenaries/:plenary', 200],
        ['POST', e + '/plenaries/:plenary/attendance/mark', 404]
    ])('%s %s should answer %i', async (method, template, status) => {
        const path = template.replace(/:(\w+)/g, (match, name) => ids[name]);

        const res = await request({
            path,
            method,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(status);
        expect(res.body.success).toEqual(status === 200);
    });
});
