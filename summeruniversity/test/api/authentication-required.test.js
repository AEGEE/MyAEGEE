const fs = require('fs');
const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const table = require('../scripts/route-table');
const config = require('../../config');

const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = listOperations(spec).filter((op) => op.auth === 'required');
const writes = operations.filter((op) => op.method !== 'GET');
const rows = (ops) => ops.map((op) => [`${op.method} ${op.template}`, op]);

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
        await fs.promises.rm(config.media_dir, { recursive: true, force: true });
    });

    const send = (op, fixtures) => request({
        method: op.method,
        path: table.paths[op.operationId](fixtures),
        headers: { 'X-Auth-Token': 'foobar' },
        body: table.bodies[op.operationId],
        files: table.files[op.operationId]
    });

    test('every authenticated operation has a row in route-table.js', () => {
        expect(operations.map((op) => op.operationId).filter((id) => !table.paths[id])).toEqual([]);
    });

    test('every authenticated write checks that it changed nothing', () => {
        expect(writes.map((op) => op.operationId).filter((id) => !table.unchanged[id])).toEqual([]);
    });

    test.each(rows(operations))('%s answers 401', async (_, op) => {
        const fixtures = await table.createFixtures();
        table.asAnonymous();

        const res = await send(op, fixtures);

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });

    // The control: with a session, the same request goes through and changes what the 401
    // row checks, so the 401 row would notice a write that an anonymous caller got through.
    test.each(rows(writes))('%s with a session changes what its 401 row checks', async (_, op) => {
        const fixtures = await table.createFixtures();
        table.asFullPermissions();

        const res = await send(op, fixtures);

        expect(res.statusCode).toBeLessThan(300);
        await expect(table.unchanged[op.operationId](fixtures)).rejects.toThrow();
    });
});
