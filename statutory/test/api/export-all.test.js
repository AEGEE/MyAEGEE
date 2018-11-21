const xlsx = require('node-xlsx')

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
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // at least 1 sheet

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1); // 1 string in sheet
    });

    test('should return nothing if only cancelled applications', async () => {
        await generator.createApplication({ cancelled: true, user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1);
    });

    test('should return something if there are not cancelled applications', async () => {
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2);
    });

    test('should return 403 if you have no permissions to access', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
    });

    test('should return 500 if /bodies return net error', async () => {
        mock.mockAll({ bodies: { netError: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should return 500 if /bodies return malformed response', async () => {
        mock.mockAll({ bodies: { badResponse: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should return 500 if /bodies return unsuccessful response', async () => {
        mock.mockAll({ bodies: { unsuccessfulResponse: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should return 500 if /members return net error', async () => {
        mock.mockAll({ members: { netError: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should return 500 if /members return malformed response', async () => {
        mock.mockAll({ members: { badResponse: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should return 500 if /members return unsuccessful response', async () => {
        mock.mockAll({ members: { unsuccessfulResponse: true } });
        await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should skip user if body is not found', async () => {
        await generator.createApplication({ user_id: regularUser.id, body_id: 0 }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1);
    });

    test('should skip user if user is not found', async () => {
        await generator.createApplication({ user_id: 0 }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            json: false,
            encoding: null,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1);
    });
});
