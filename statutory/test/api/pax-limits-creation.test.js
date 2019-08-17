const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Pax limits creation/editing', () => {
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

    test('should update the limit if exists', async () => {
        const limit = generator.generatePaxLimit();
        const res = await request({
            uri: '/limits/agora',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should update the limit if not exists', async () => {
        await generator.createPaxLimit({ body_id: 1, event_type: 'agora' });
        const limit = generator.generatePaxLimit({ body_id: 1, event_type: 'agora' });

        const res = await request({
            uri: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should allow creating the limit if the limit exists for different event type', async () => {
        await generator.createPaxLimit({ body_id: 1, event_type: 'epm' });
        const limit = generator.generatePaxLimit({ body_id: 1, event_type: 'agora' });

        const res = await request({
            uri: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should return 400 if the event type is invalid', async () => {
        const limit = generator.generatePaxLimit();

        const res = await request({
            uri: '/limits/invalid/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const limit = generator.generatePaxLimit();

        const res = await request({
            uri: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 422 if some of the values is not an integer', async () => {
        const limit = generator.generatePaxLimit({ envoy: false });

        const res = await request({
            uri: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('envoy');
    });

    test('should return 422 if some of the values is negative', async () => {
        const limit = generator.generatePaxLimit({ envoy: -1 });

        const res = await request({
            uri: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('envoy');
    });

    test('should allow saving if some of the values are null', async () => {
        const limit = generator.generatePaxLimit({ envoy: null });

        const res = await request({
            uri: '/limits/agora/',
            method: 'POST',
            body: limit,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.envoy).toEqual(null);
    });
});
