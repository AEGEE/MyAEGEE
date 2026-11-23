const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const bodies = require('../assets/core-bodies.json').data;

// What the two bodies of the core mock, an antenna and a committee, may send by default.
// Null is no limit. Everything that is not an Agora has the limits of an EPM.
const DEFAULTS = {
    agora: [
        { body_id: 34, delegate: 3, envoy: 0, observer: 0, visitor: 30 },
        { body_id: 9, delegate: 0, envoy: 3, observer: 0, visitor: 30 }
    ],
    epm: [
        { body_id: 34, delegate: 0, envoy: null, observer: 0, visitor: 0 },
        { body_id: 9, delegate: 0, envoy: 0, observer: 0, visitor: 0 }
    ],
    spm: [
        { body_id: 34, delegate: 0, envoy: null, observer: 0, visitor: 0 },
        { body_id: 9, delegate: 0, envoy: 0, observer: 0, visitor: 0 }
    ]
};

const asDefault = (limit, type) => ({ ...limit, id: null, event_type: type, default: true });

describe('Pax limits defaults', () => {
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

    test('should display default limits', async () => {
        const res = await request({
            path: '/limits/agora/defaults',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        for (const limit of res.body.data) {
            expect(limit.default).toEqual(true);
        }
    });

    test('should return 404 if defaults receives a body id', async () => {
        const res = await request({
            path: '/limits/agora/defaults/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
            skipOpenApi: 'the not-found handler'
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the event type is invalid', async () => {
        const res = await request({
            path: '/limits/invalid/defaults',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the default request returns net error', async () => {
        mock.mockAll({ bodies: { netError: true } });
        const res = await request({
            path: '/limits/agora/defaults',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the default request returns malformed response', async () => {
        mock.mockAll({ bodies: { badResponse: true } });
        const res = await request({
            path: '/limits/agora/defaults',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the default request returns unsuccessful response', async () => {
        mock.mockAll({ bodies: { unsuccessfulResponse: true } });
        const res = await request({
            path: '/limits/agora/defaults',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    const listDefaults = async (type) => {
        const res = await request({
            path: '/limits/' + type + '/defaults',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    test.each(['agora', 'epm', 'spm'])('should give every body of core its default limit for %s', async (type) => {
        expect(await listDefaults(type)).toEqual(DEFAULTS[type].map((limit) => asDefault(limit, type)));
    });

    test('should give the defaults whatever is stored', async () => {
        for (const body of bodies) {
            await generator.createPaxLimit({ body_id: body.id, event_type: 'agora', delegate: 9, envoy: 9, observer: 9, visitor: 9 });
        }

        expect(await listDefaults('agora')).toEqual(DEFAULTS.agora.map((limit) => asDefault(limit, 'agora')));
    });

    test('should give an empty list when core lists no bodies', async () => {
        mock.mockAll({ bodies: { empty: true } });

        expect(await listDefaults('agora')).toEqual([]);
    });

    test('should answer a member without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        expect((await listDefaults('agora')).length).toEqual(2);
    });
});
