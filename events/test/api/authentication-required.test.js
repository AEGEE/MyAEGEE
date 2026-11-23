const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const table = require('../scripts/route-table');

const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = listOperations(spec).filter((op) => op.auth === 'required');

describe('Authentication required', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('every authenticated operation has a row in route-table.js', () => {
        expect(operations.map((op) => op.operationId).filter((id) => !table.paths[id])).toEqual([]);
    });

    test.each(operations.map((op) => [`${op.method} ${op.template}`, op]))('%s answers 401', async (_, op) => {
        const fixtures = await table.createFixtures();
        table.asAnonymous();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures),
            headers: { 'X-Auth-Token': 'foobar' },
            body: table.bodies[op.operationId]
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });
});
