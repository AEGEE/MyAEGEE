const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Export OpenSlides', () => {
    let event;
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
        event = await generator.createEvent({ applications: [] });
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter(l => l.length > 0);
        expect(body.length).toEqual(1);
    });

    test('should return nothing if only cancelled or not accepted applications', async () => {
        await generator.createApplication({ cancelled: true, status: 'accepted', user_id: 1 }, event);
        await generator.createApplication({ cancelled: false, status: 'rejected', user_id: 2 }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter(l => l.length > 0);
        expect(body.length).toEqual(1);
    });

    test('should return the application if there are not cancelled and accepted application', async () => {
        await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter(l => l.length > 0);
        expect(body.length).toEqual(2);
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            json: false,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
    });
});
