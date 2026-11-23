const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { PaxLimit } = require('../../models');

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
            path: '/limits/agora',
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
            path: '/limits/agora/',
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
            path: '/limits/agora/',
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
            path: '/limits/invalid/',
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
            path: '/limits/agora/',
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
            path: '/limits/agora/',
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
            path: '/limits/agora/',
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
            path: '/limits/agora/',
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

    test.each([
        ['is missing', undefined],
        ['is null', null],
        ['is not a number', 'abc'],
        ['is not a whole number', 1.5],
        ['is an object', { id: 1 }]
    ])('should return 422 if body_id %s', async (description, bodyId) => {
        const limit = generator.generatePaxLimit({ event_type: 'agora' });
        limit.body_id = bodyId;

        const res = await request({
            path: '/limits/agora',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: limit
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('body_id');
        expect(await PaxLimit.count()).toEqual(0);
    });
});
