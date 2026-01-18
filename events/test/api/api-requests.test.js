const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('API requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    it('should fail if the user is unauthorized for autnorized-only endpoint', async () => {
        mock.mockAll({ core: { unauthorized: true } });

        const event = await generator.createEvent({
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'string', description: 'test', required: true }
            ]
        });
        const res = await request({
            uri: '/single/' + event.id + '/applications',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core is unaccessible for user', async () => {
        mock.mockAll({ core: { netError: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns non-JSON data for user', async () => {
        mock.mockAll({ core: { badResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns unsuccessful response for user', async () => {
        mock.mockAll({ core: { unsuccessfulResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core is unaccessible for permissions', async () => {
        mock.mockAll({ mainPermissions: { netError: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns non-JSON data for permissions', async () => {
        mock.mockAll({ mainPermissions: { badResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns unsuccessful response for permissions', async () => {
        mock.mockAll({ mainPermissions: { unsuccessfulResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core is unaccessible for approve permissions', async () => {
        mock.mockAll({ approvePermissions: { netError: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns non-JSON data for approve permissions', async () => {
        mock.mockAll({ approvePermissions: { badResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if the oms-core returns unsuccessful response for approve permissions', async () => {
        mock.mockAll({ approvePermissions: { unsuccessfulResponse: true } });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if body is not JSON', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: 'Some random string'
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
    });

    it('should fail on accessing non-existant endpoint', async () => {
        const res = await request({
            uri: '/nonexistant',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });
});
