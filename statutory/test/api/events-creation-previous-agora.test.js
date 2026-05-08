const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Events previous_agora_id setting', () => {
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

    test('should succeed if event.type is not Agora', async () => {
        const event = generator.generateEvent({
            type: 'epm'
        });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'bla' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('previous_agora_id');
        expect(res.body.data.previous_agora_id).toEqual(null);
    });

    test('should set previous Agora correctly if it was published', async () => {
        await generator.createEvent({
            id: 1,
            type: 'agora',
            status: 'published'
        });

        const event = generator.generateEvent({
            type: 'agora'
        });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'bla' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('previous_agora_id');
        expect(res.body.data.previous_agora_id).toEqual(1);
    });

    test('should not set previous Agora if it was not published', async () => {
        await generator.createEvent({
            id: 1,
            type: 'agora'
        });

        const event = generator.generateEvent({
            type: 'agora'
        });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'bla' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('previous_agora_id');
        expect(res.body.data.previous_agora_id).toEqual(null);
    });

    test('should set previous_agora_id as null if no previous Agora', async () => {
        const event = generator.generateEvent({
            type: 'agora'
        });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'bla' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('previous_agora_id');
        expect(res.body.data.previous_agora_id).toEqual(null);
    });
});
