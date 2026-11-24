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

describe('Pax limits listing', () => {
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

    test('should display limits', async () => {
        const res = await request({
            path: '/limits/agora',
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

    test('should display custom limits', async () => {
        for (const body of bodies) {
            await generator.createPaxLimit({ body_id: body.id, event_type: 'agora' });
        }

        const res = await request({
            path: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        for (const limit of res.body.data) {
            expect(limit.default).toEqual(false);
        }
    });

    test('should return 400 if the event type is invalid', async () => {
        const res = await request({
            path: '/limits/invalid',
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
            path: '/limits/agora',
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
            path: '/limits/agora',
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
            path: '/limits/agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    const list = async (type) => {
        const res = await request({
            path: '/limits/' + type,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    test.each(['agora', 'epm', 'spm'])('should give every body of core its default limit for %s when nothing is stored', async (type) => {
        expect(await list(type)).toEqual(DEFAULTS[type].map((limit) => asDefault(limit, type)));
    });

    test('should give the stored limit of a body and the default of the others', async () => {
        const stored = await generator.createPaxLimit({ body_id: 9, event_type: 'agora', delegate: 1, envoy: null, observer: 2, visitor: 0 });
        // Neither of these counts for an Agora.
        await generator.createPaxLimit({ body_id: 34, event_type: 'epm', delegate: 7, envoy: 7, observer: 7, visitor: 7 });
        await generator.createPaxLimit({ body_id: 34, event_type: 'spm', delegate: 8, envoy: 8, observer: 8, visitor: 8 });

        const limits = await list('agora');

        expect(limits.length).toEqual(2);
        expect(limits[0]).toEqual(asDefault(DEFAULTS.agora[0], 'agora'));
        expect(limits[1]).toMatchObject({
            id: stored.id,
            body_id: 9,
            event_type: 'agora',
            delegate: 1,
            envoy: null,
            observer: 2,
            visitor: 0,
            default: false
        });
    });

    test('should leave out the stored limit of a body that core does not list', async () => {
        await generator.createPaxLimit({ body_id: 1337, event_type: 'agora' });

        expect((await list('agora')).map((limit) => limit.body_id)).toEqual([34, 9]);
    });

    test('should give an empty list when core lists no bodies', async () => {
        mock.mockAll({ bodies: { empty: true } });
        await generator.createPaxLimit({ body_id: 34, event_type: 'agora' });

        expect(await list('agora')).toEqual([]);
    });

    test('should answer a member without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        expect((await list('agora')).length).toEqual(2);
    });
});
