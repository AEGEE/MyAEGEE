const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Candidates editing', () => {
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

    test('should return 403 if the application is not pending', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id, status: 'approved' })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if candidate is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/1337',
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if candidate ID is NaN', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/false',
            method: 'PUT',
            body: { first_name: 'Different' },
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
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });
});
