const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

const { Code } = require('../../models');

describe('Integrations codes population', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should fail if user does not have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const integration = await generator.createIntegration({ code: 'first' });

        const res = await request({
            uri: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first', 'second', 'third']
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            uri: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first', 'second', 'third']
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const codesFromDb = await Code.count({ where: { integration_id: integration.id } });
        expect(codesFromDb).toEqual(3);
    });

    test('should fail if body is not an array', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            uri: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if body is empty array', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            uri: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: []
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
