const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const table = require('../scripts/route-table');
const { Event } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });

// The request body of an operation, with a $ref to components.requestBodies resolved.
const requestBodyOf = (op) => {
    const body = spec.paths[op.template][op.method.toLowerCase()].requestBody;
    return body && body.$ref ? spec.components.requestBodies[body.$ref.split('/').pop()] : body;
};

// Every operation that reads a JSON body.
const jsonWrites = listOperations(spec).filter((op) => {
    const body = requestBodyOf(op);
    return Boolean(body && body.content['application/json']);
});

// Every write takes an object as its body: anything else answers 400 before the handler runs,
// changes nothing and sends no mail. Express parses a JSON array as a body too.
describe('Request bodies', () => {
    let mails;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        mails = mock.captureMails(table.asFullPermissions().omsMailerStub);
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('every write with a JSON body is in the sweep', () => {
        expect(jsonWrites.map((op) => op.operationId).sort()).toEqual([
            'createApplication', 'createEvent', 'setApplicationAttended', 'setApplicationBoardComment',
            'setApplicationConfirmed', 'setApplicationStatus', 'setEventEuropeanStatus', 'setEventStatus',
            'updateApplication', 'updateEvent'
        ]);
    });

    test.each(jsonWrites.map((op) => [`${op.method} ${op.template}`, op]))('%s answers 400 for a list as the body', async (_, op) => {
        const fixtures = await table.createFixtures();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures),
            headers: { 'X-Auth-Token': 'foobar' },
            body: [1, 2]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The body should be an object.' });
        await table.unchanged[op.operationId](fixtures);
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
        ['U+0000 in a key', { locations: [{ 'name\u0000': 'x' }] }, 'The body should not contain the character U+0000.'],
        ['65 levels', { name: nested(64, 'x') }, 'The body is nested too deeply.']
    ];

    test.each(jsonWrites.flatMap((op) => BAD_BODIES.map(([name, body, message]) => [`${op.method} ${op.template}`, name, op, body, message])))('%s answers 400 for a body with %s', async (_, _name, op, body, message) => {
        const fixtures = await table.createFixtures();

        const res = await request({ method: op.method, path: table.paths[op.operationId](fixtures), headers: { 'X-Auth-Token': 'foobar' }, body });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message });
        await table.unchanged[op.operationId](fixtures);
        expect(mails).toEqual([]);
    });

    test('takes a body nested 64 levels deep to the route', async () => {
        const event = await generator.createEvent();

        const res = await request({ method: 'PUT', path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' }, body: { name: nested(63, 'x') } });

        expect(res.statusCode).toEqual(422);
        expect(Object.keys(res.body.errors)).toEqual(['name']);
    });

    test.each([
        ['POST', '/', 'x'],
        ['PUT', '/single/:id', 'x'],
        ['PUT', '/single/:id', 'a\u0000b']
    ])('%s %s answers 400 for a body nested 10,000 levels deep (bottom %j), without running out of stack', async (method, template, bottom) => {
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

    test.each(jsonWrites.flatMap((op) => UNREADABLE.map(([name, status, headers, body]) => [`${op.method} ${op.template}`, name, op, status, headers, body])))('%s answers its 4xx for a body %s', async (_, _name, op, status, headers, body) => {
        const fixtures = await table.createFixtures();

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
        const event = await generator.createEvent();

        const res = await request({
            method: 'PUT',
            path: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json', 'Content-Encoding': encoding },
            rawBody: body
        });

        expect(res.statusCode).toEqual(status);
        expect(res.body).toEqual({ success: false, message: 'The request body could not be read.' });
    });

    // The edit forms send every long text of an event in one request.
    test('takes an edit of 300 kB', async () => {
        const event = await generator.createEvent();
        const description = 'Long description. '.repeat(17000);

        const res = await request({ method: 'PUT', path: '/single/' + event.id, headers: { 'X-Auth-Token': 'foobar' }, body: { description } });

        expect(res.statusCode).toEqual(200);
        expect((await Event.findByPk(event.id)).description).toEqual(description);
    });

    // The routes read the body without checking that there is one (POST / answered 500).
    test.each([
        ['POST', '/', 403, 'User creating the event should be the organizers.'],
        ['PUT', '/single/:id', 422, 'No valid field changes requested']
    ])('%s %s without a body is a request with an empty one', async (method, template, status, message) => {
        const event = await generator.createEvent();

        const res = await request({ method, path: template.replace(':id', event.id), headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(status);
        expect(res.body.message).toEqual(message);
        expect(await Event.count()).toEqual(1);
        expect(mails).toEqual([]);
    });

    // JSON.parse makes these own keys of the body; Sequelize read them as setters and failed.
    const PROTOTYPE_KEYS = '"__proto__": {"name": "x"}, "constructor": {"name": "x"}, "prototype": {"name": "x"}';

    test('a new event ignores __proto__, constructor and prototype in the body', async () => {
        const event = generator.generateEvent({ organizers: [{ user_id: user.id }], organizing_bodies: [{ body_id: user.bodies[0].id }] });

        const res = await request({
            method: 'POST',
            path: '/',
            headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json' },
            rawBody: JSON.stringify(event).replace(/^\{/, `{${PROTOTYPE_KEYS}, `)
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.name).toEqual(event.name);
    });

    test('an edit ignores __proto__, constructor and prototype in the body', async () => {
        const event = await generator.createEvent();

        const res = await request({
            method: 'PUT',
            path: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json' },
            rawBody: `{${PROTOTYPE_KEYS}, "description": "Changed"}`
        });

        expect(res.statusCode).toEqual(200);
        expect((await Event.findByPk(event.id)).description).toEqual('Changed');
    });

    test('a body of only __proto__ is a request without a field to change', async () => {
        const event = await generator.createEvent();

        const res = await request({
            method: 'PUT',
            path: '/single/' + event.id,
            headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json' },
            rawBody: '{"__proto__": {"description": "x"}}'
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('No valid field changes requested');
    });
});
