const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const bodies = require('../assets/core-bodies.json').data;

describe('Pax limits single', () => {
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

    test('should display limit', async () => {
        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.default).toEqual(true);
    });

    test('should display custom limit', async () => {
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora' });

        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.default).toEqual(false);
    });

    test('should return 400 if the event type is invalid', async () => {
        const res = await request({
            path: '/limits/invalid/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the bodies request returns net error', async () => {
        mock.mockAll({ body: { netError: true } });
        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the bodies request returns malformed response', async () => {
        mock.mockAll({ body: { badResponse: true } });
        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if the bodies request returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });
        const res = await request({
            path: '/limits/agora/' + bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    const getLimit = async (type, bodyId = bodies[0].id) => {
        const res = await request({
            path: '/limits/' + type + '/' + bodyId,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    // The core mock answers with the user's antenna for every body id.
    test.each([
        ['agora', { delegate: 3, envoy: 0, observer: 0, visitor: 30 }],
        ['epm', { delegate: 0, envoy: null, observer: 0, visitor: 0 }],
        ['spm', { delegate: 0, envoy: null, observer: 0, visitor: 0 }]
    ])('should give an antenna its default limit for %s when nothing is stored', async (type, limit) => {
        expect(await getLimit(type)).toEqual({
            ...limit,
            id: null,
            body_id: bodies[0].id,
            event_type: type,
            default: true
        });
    });

    test.each([
        ['partner', { delegate: 0, envoy: 3, observer: 0, visitor: 0 }],
        ['contact antenna', { delegate: 0, envoy: 3, observer: 0, visitor: 30 }],
        ['contact', { delegate: 0, envoy: 0, observer: null, visitor: 0 }],
        ['working group', { delegate: 0, envoy: 3, observer: 0, visitor: 30 }],
        ['interest group', { delegate: 0, envoy: 0, observer: 0, visitor: 30 }],
        ['a type that has no default', { delegate: 0, envoy: 0, observer: 0, visitor: 0 }]
    ])('should give a body of the type "%s" its default limit for an Agora', async (type, limit) => {
        mock.mockAll({ body: { type } });

        expect(await getLimit('agora')).toMatchObject({ ...limit, default: true });
    });

    test('should give the stored limit of the body for this event type', async () => {
        const stored = await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'agora', delegate: 1, envoy: null, observer: 2, visitor: 0 });
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'epm', delegate: 7, envoy: 7, observer: 7, visitor: 7 });
        await generator.createPaxLimit({ body_id: 1337, event_type: 'agora', delegate: 8, envoy: 8, observer: 8, visitor: 8 });

        expect(await getLimit('agora')).toMatchObject({
            id: stored.id,
            body_id: bodies[0].id,
            event_type: 'agora',
            delegate: 1,
            envoy: null,
            observer: 2,
            visitor: 0,
            default: false
        });
    });

    test('should give the default when the body only has a limit for another event type', async () => {
        await generator.createPaxLimit({ body_id: bodies[0].id, event_type: 'epm', delegate: 7, envoy: 7, observer: 7, visitor: 7 });

        expect(await getLimit('agora')).toMatchObject({ delegate: 3, envoy: 0, observer: 0, visitor: 30, default: true });
    });

    test('should answer a member without permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        expect((await getLimit('agora')).default).toEqual(true);
    });
});
