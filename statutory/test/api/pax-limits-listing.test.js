const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const bodies = require('../assets/oms-core-bodies').data;

describe('Pax limits listing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should display default limits', async () => {
        const res = await request({
            uri: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        for (const limit of res.body.data) {
            expect(limit.default).toEqual(true)
        }
    });

    test('should display custom limits', async () => {
        for (const body of bodies) {
            await generator.createPaxLimit({ body_id: body.id, event_type: 'agora' });
        }

        const res = await request({
            uri: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        for (const limit of res.body.data) {
            expect(limit.default).toEqual(false)
        }
    });

    test('should return 400 if the event type is invalid', async () => {
        const res = await request({
            uri: '/limits/invalid',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the bodies request returns net error', async () => {
        mock.mockAll({ bodies: { netError: true } });
        const res = await request({
            uri: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the bodies request returns malformed response', async () => {
        mock.mockAll({ bodies: { badResponse: true } });
        const res = await request({
            uri: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the bodies request returns unsuccessful response', async () => {
        mock.mockAll({ bodies: { unsuccessfulResponse: true } });
        const res = await request({
            uri: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
