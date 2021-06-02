const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Export Delegates JC', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({ applications: [], type: 'agora' });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/delegates_jc',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter((l) => l.length > 0);
        expect(body.length).toEqual(0);
    });

    test('should return nothing if only cancelled, not accepted or non-delegate applications', async () => {
        await generator.createApplication({ cancelled: true, status: 'accepted', user_id: 1 }, event);
        await generator.createApplication({ cancelled: false, status: 'rejected', user_id: 2 }, event);
        await generator.createApplication({ cancelled: false, status: 'accepted', participant_type: 'visitor', user_id: 3 }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/delegates_jc',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter((l) => l.length > 0);
        expect(body.length).toEqual(0);
    });

    test('should return the application if it is not cancelled, accepted and a delegate', async () => {
        await generator.createApplication({ user_id: regularUser.id, status: 'accepted', participant_type: 'delegate' }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/delegates_jc',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter((l) => l.length > 0);
        expect(body.length).toEqual(1);
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/delegates_jc',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
    });
});
