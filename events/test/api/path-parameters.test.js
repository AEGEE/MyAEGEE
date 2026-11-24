const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const table = require('../scripts/route-table');

const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = listOperations(spec);
const withNotFound = operations.filter((op) => op.statuses.includes('404') && op.pathParams.length > 0);
const withBadRequest = operations.filter((op) => op.statuses.includes('400') && op.pathParams.length > 0);

const notFoundRows = withNotFound.flatMap((op) => (table.lookups[op.operationId] || [])
    .map((param) => [`${op.method} ${op.template} with an unknown ${param}`, op, param]));
const badRequestRows = withBadRequest.flatMap((op) => (table.badIds[op.operationId] || [])
    .map((param) => [`${op.method} ${op.template} with a ${param} that is not a number`, op, param]));
// The route's own not-found answers; the catch-all for unknown routes says "No such API endpoint".
const NOT_FOUND = {
    event_id: (value) => `Event with id ${value} not found`,
    application_id: (value) => `Application with id ${value} not found`
};
const expectOwnNotFound = (res, message) => {
    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toEqual(false);
    expect(res.body.message).toEqual(message);
    expect(res.body.message).not.toMatch(/^No such API endpoint/);
};

const childRows = withNotFound.filter((op) => op.pathParams.includes('application_id'))
    .map((op) => [`${op.method} ${op.template}`, op]);

describe('Path parameters', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        table.asFullPermissions();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('every operation with a documented 404 lists its looked-up parameters in route-table.js', () => {
        expect(withNotFound.map((op) => op.operationId).filter((id) => !table.lookups[id])).toEqual([]);
    });

    test('every operation with a documented 400 lists its numeric parameters in route-table.js', () => {
        expect(withBadRequest.map((op) => op.operationId).filter((id) => !table.badIds[id])).toEqual([]);
    });

    test.each(notFoundRows)('%s answers 404', async (_, op, param) => {
        const fixtures = await table.createFixtures();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures, { [param]: table.NONEXISTENT_ID }),
            headers: { 'X-Auth-Token': 'foobar' },
            body: table.bodies[op.operationId]
        });

        expectOwnNotFound(res, NOT_FOUND[param](table.NONEXISTENT_ID));
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });

    test.each(badRequestRows)('%s answers 400', async (_, op, param) => {
        const fixtures = await table.createFixtures();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures, { [param]: 'abc' }),
            headers: { 'X-Auth-Token': 'foobar' },
            body: table.bodies[op.operationId]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });

    test.each(childRows)('%s answers 404 for an application of another event', async (_, op) => {
        const fixtures = await table.createFixtures();
        const otherEvent = await generator.createEvent();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures, { event_id: otherEvent.id }),
            headers: { 'X-Auth-Token': 'foobar' },
            body: table.bodies[op.operationId]
        });

        expectOwnNotFound(res, NOT_FOUND.application_id(fixtures.application.id));
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });

    test('an unknown event url answers 404', async () => {
        const res = await request({
            path: '/single/no-such-event',
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expectOwnNotFound(res, NOT_FOUND.event_id('no-such-event'));
    });
});
