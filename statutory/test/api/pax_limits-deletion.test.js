const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const bodies = require('../assets/oms-core-bodies').data;

describe('Pax limits deletion', () => {
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
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should allow deleting custom limit', async () => {
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            uri: '/limits/agora/' + bodies[0].id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should not allow deleting limit when there\'s no limit', async () => {
        const res = await request({
            uri: '/limits/agora/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the event type is invalid', async () => {
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            uri: '/limits/invalid/' + bodies[0].id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the body_id is invalid', async () => {
        const res = await request({
            uri: '/limits/agora/invalid',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            uri: '/limits/agora/' + bodies[0].id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });
});
