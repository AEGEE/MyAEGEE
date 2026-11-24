const fs = require('fs');
const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const table = require('../scripts/route-table');
const { Event, Season } = require('../../models');
const config = require('../../config');

const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });

// The request body of an operation, following a $ref to components/requestBodies.
const requestBodyOf = (op) => {
    const body = spec.paths[op.template][op.method.toLowerCase()].requestBody;
    if (body && body.$ref) {
        return spec.components.requestBodies[body.$ref.split('/').pop()];
    }
    return body;
};
const withJsonBody = listOperations(spec).filter((op) => {
    const body = requestBodyOf(op);
    return Boolean(body && body.content && body.content['application/json']);
});
const rows = withJsonBody.map((op) => [`${op.method} ${op.template}`, op]);

const MESSAGE = 'The body should be an object.';

describe('Request body', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
        await fs.promises.rm(config.media_dir, { recursive: true, force: true });
    });

    test('every operation with a JSON body has a row in route-table.js and documents the 400', () => {
        expect(withJsonBody.length).toBeGreaterThan(0);
        expect(withJsonBody.filter((op) => !table.paths[op.operationId] || !table.unchanged[op.operationId]).map((op) => op.operationId)).toEqual([]);
        expect(withJsonBody.filter((op) => !op.statuses.includes('400')).map((op) => op.operationId)).toEqual([]);
    });

    // A list as the body answered as if it were an object: PUT /single/:id with [1,2] answered
    // 200 and mailed the organizers.
    test.each(rows)('%s refuses a list as the body', async (_, op) => {
        const fixtures = await table.createFixtures();
        const mails = mock.captureMails(table.asFullPermissions().omsMailerStub);

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures),
            headers: { 'X-Auth-Token': 'foobar' },
            body: [1, 2]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: MESSAGE });
        await table.unchanged[op.operationId](fixtures);
        expect(mails).toEqual([]);
    });

    // The handlers read the body without checking that there is one: POST / answered 500.
    test.each([
        ['POST', () => '/', 403, 'User creating the event should be one of the organizers.'],
        ['PUT', (fixtures) => `/single/${fixtures.event.id}`, 422, 'No valid field changes requested']
    ])('%s without a body is a request with an empty one', async (method, pathOf, status, message) => {
        const fixtures = await table.createFixtures();
        const mails = mock.captureMails(table.asFullPermissions().omsMailerStub);
        const before = await Event.count();

        const res = await request({ method, path: pathOf(fixtures), headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(status);
        expect(res.body.message).toEqual(message);
        expect(await Event.count()).toEqual(before);
        expect(mails).toEqual([]);
    });

    // Parsed from JSON text, because a JavaScript object literal does not keep __proto__ as a
    // key; JSON.parse does, and JSON.stringify sends it again.
    const withPrototypeKeys = (body) => JSON.parse(JSON.stringify(body)
        .replace(/^\{/, '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},'));

    test('creating a Summer University ignores the __proto__, constructor and prototype keys', async () => {
        table.asFullPermissions();

        const res = await request({
            method: 'POST',
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            body: withPrototypeKeys(generator.generateEventBody({ name: 'Test Summer University' }))
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data).not.toHaveProperty('polluted');
        expect(({}).polluted).toBeUndefined();
        const event = await Event.findByPk(res.body.data.id);
        expect(event.name).toEqual('Test Summer University');
    });

    test('editing a Summer University ignores the __proto__, constructor and prototype keys', async () => {
        table.asFullPermissions();
        const event = await generator.createEvent();

        const res = await request({
            method: 'PUT',
            path: `/single/${event.id}`,
            headers: { 'X-Auth-Token': 'foobar' },
            body: withPrototypeKeys({ description: 'Changed by the test' })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).not.toHaveProperty('polluted');
        expect(({}).polluted).toBeUndefined();
        expect((await Event.findByPk(event.id)).description).toEqual('Changed by the test');
    });

    test('editing a season ignores the __proto__, constructor and prototype keys', async () => {
        table.asFullPermissions();

        const res = await request({
            method: 'PUT',
            path: '/seasons/2026',
            headers: { 'X-Auth-Token': 'foobar' },
            body: withPrototypeKeys({ name: 'Test season' })
        });

        expect(res.statusCode).toEqual(200);
        expect((await Season.findOne({ where: { year: 2026 } })).name).toEqual('Test season');
    });
});
