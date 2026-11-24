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
