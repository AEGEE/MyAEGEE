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

    // Postgres refuses the character U+0000 in a JSON column (500), and a deeply nested body
    // made the validation run out of stack. Both are checked before any route runs, by walking
    // the body without recursion.
    const nested = (depth, bottom) => {
        let body = bottom;
        for (let level = 0; level < depth; level++) {
            body = [body];
        }
        return body;
    };
    const BAD_BODIES = [
        ['U+0000 in a string', { questions: [{ description: 'a\u0000b' }] }, 'The body should not contain the character U+0000.'],
        ['U+0000 in a key', { social_media: [{ 'name\u0000': 'x' }] }, 'The body should not contain the character U+0000.'],
        ['65 levels', { name: nested(64, 'x') }, 'The body is nested too deeply.']
    ];

    test.each(withJsonBody.flatMap((op) => BAD_BODIES.map(([name, body, message]) => [`${op.method} ${op.template}`, name, op, body, message])))('%s answers 400 for a body with %s', async (_, _name, op, body, message) => {
        const fixtures = await table.createFixtures();
        const mails = mock.captureMails(table.asFullPermissions().omsMailerStub);

        const res = await request({ method: op.method, path: table.paths[op.operationId](fixtures), headers: { 'X-Auth-Token': 'foobar' }, body });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message });
        await table.unchanged[op.operationId](fixtures);
        expect(mails).toEqual([]);
    });

    test('takes a body nested 64 levels deep to the route', async () => {
        table.asFullPermissions();
        const event = await generator.createEvent();

        const res = await request({ method: 'PUT', path: `/single/${event.id}`, headers: { 'X-Auth-Token': 'foobar' }, body: { name: nested(63, 'x') } });

        expect(res.statusCode).toEqual(422);
        expect(Object.keys(res.body.errors)).toEqual(['name']);
    });

    test.each([
        ['POST', '/', 'x'],
        ['PUT', '/single/:id', 'x'],
        ['PUT', '/single/:id', 'a\u0000b']
    ])('%s %s answers 400 for a body nested 10,000 levels deep (bottom %j), without running out of stack', async (method, template, bottom) => {
        table.asFullPermissions();
        const event = await generator.createEvent();

        const res = await request({
            method,
            path: template.replace(':id', event.id),
            headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json' },
            rawBody: `{"name": ${'['.repeat(10000)}${JSON.stringify(bottom)}${']'.repeat(10000)}}`
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual('The body is nested too deeply.');
        expect(JSON.stringify(res.body)).not.toContain('Maximum call stack');
    });

    // Body-parser refuses these; they answered 500 with its message.
    const UNREADABLE = [
        ['over 1 MB', 413, { 'Content-Type': 'application/json' }, () => JSON.stringify({ description: 'a'.repeat(1024 * 1024) })],
        ['in another charset', 415, { 'Content-Type': 'application/json; charset=latin1' }, () => '{"description": "Changed"}']
    ];

    test.each(withJsonBody.flatMap((op) => UNREADABLE.map(([name, status, headers, body]) => [`${op.method} ${op.template}`, name, op, status, headers, body])))('%s answers its 4xx for a body %s', async (_, _name, op, status, headers, body) => {
        const fixtures = await table.createFixtures();
        const mails = mock.captureMails(table.asFullPermissions().omsMailerStub);

        const res = await request({ method: op.method, path: table.paths[op.operationId](fixtures), headers: { 'X-Auth-Token': 'foobar', ...headers }, rawBody: body() });

        expect(res.statusCode).toEqual(status);
        expect(res.body).toEqual({ success: false, message: 'The request body could not be read.' });
        await table.unchanged[op.operationId](fixtures);
        expect(mails).toEqual([]);
    });

    test.each([
        ['an unknown encoding', 415, 'br2', Buffer.from('{}')],
        ['broken gzip', 400, 'gzip', Buffer.from('not gzip at all')]
    ])('a body in %s answers %i', async (_name, status, encoding, body) => {
        table.asFullPermissions();
        const event = await generator.createEvent();

        const res = await request({
            method: 'PUT',
            path: `/single/${event.id}`,
            headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json', 'Content-Encoding': encoding },
            rawBody: body
        });

        expect(res.statusCode).toEqual(status);
        expect(res.body).toEqual({ success: false, message: 'The request body could not be read.' });
    });

    // The second edit form sends every long text of a Summer University in one request.
    test('takes an edit of 300 kB', async () => {
        table.asFullPermissions();
        const event = await generator.createEvent();
        const text = 'A long text of the programme. '.repeat(1700);
        const fields = ['description', 'programme', 'activities_list', 'courses', 'cancellation_rules', 'additional_regulation'];

        const res = await request({ method: 'PUT', path: `/single/${event.id}`, headers: { 'X-Auth-Token': 'foobar' }, body: Object.fromEntries(fields.map((field) => [field, text])) });

        expect(res.statusCode).toEqual(200);
        const stored = await Event.findByPk(event.id);
        expect(fields.map((field) => stored[field])).toEqual(fields.map(() => text));
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
