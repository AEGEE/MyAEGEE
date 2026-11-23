const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application, MembersList } = require('../../models');

// A body that core does not know answers 404, on every route that looks a body up.
describe('Bodies that do not exist', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ body: { notFound: true } });

        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const expectBodyNotFound = (res) => {
        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Body is not found.');
        expect(res.body).not.toHaveProperty('data');
    };

    test.each(['1337', 'abc'])('should return 404 for the participants limit of body %s', async (bodyId) => {
        const res = await request({
            path: '/limits/agora/' + bodyId,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expectBodyNotFound(res);
    });

    test('should return 404 when setting the board view of the body', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: []
        });

        expectBodyNotFound(res);
    });

    test('should return 404 when setting the participant type of an application of the body', async () => {
        const application = await generator.createApplication({
            user_id: 1337,
            participant_type: null,
            participant_order: null
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'visitor', participant_order: 1 }
        });

        expectBodyNotFound(res);

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.participant_type).toEqual(null);
    });

    test('should return 404 when uploading the memberslist of the body', async () => {
        const res = await request({
            path: '/events/' + event.id + '/memberslists/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({})
        });

        expectBodyNotFound(res);
        expect(await MembersList.count()).toEqual(0);
    });

    test('should return 404 when applying for a body that core does not know any more', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({ body_id: regularUser.bodies[0].id }, event)
        });

        expectBodyNotFound(res);
        expect(await Application.count()).toEqual(0);
    });
});
