const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const mailer = require('../../lib/mailer');
const table = require('../scripts/route-table');

const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = listOperations(spec);

const notFoundRows = operations
    .filter((op) => op.statuses.includes('404'))
    .flatMap((op) => (table.lookups[op.operationId] || []).map((param) => [`${op.method} ${op.template} with an unknown ${param}`, op, param]));

const badRequestRows = operations
    .filter((op) => op.statuses.includes('400'))
    .flatMap((op) => op.pathParams.map((param) => [`${op.method} ${op.template} with a non-numeric ${param}`, op, param]));

describe('Path parameters', () => {
    let sendMailSpy;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        table.asFullPermissions();
        sendMailSpy = jest.spyOn(mailer, 'sendMail');
    });

    afterEach(async () => {
        sendMailSpy.mockRestore();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('every operation with a 404 and a path parameter has a lookups entry in route-table.js', () => {
        const missing = operations
            .filter((op) => op.statuses.includes('404') && op.pathParams.length > 0)
            .map((op) => op.operationId)
            .filter((id) => !table.lookups[id]);

        expect(missing).toEqual([]);
    });

    test('every looked-up operation has its 404 message in route-table.js', () => {
        const missing = notFoundRows
            .map(([, op]) => op.operationId)
            .filter((id) => !table.notFoundMessages[id]);

        expect(missing).toEqual([]);
    });

    test.each(notFoundRows)('%s answers 404', async (_, op, param) => {
        const fixtures = await table.createFixtures();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures, { [param]: table.NONEXISTENT_ID }),
            headers: { 'X-Auth-Token': 'blablabla' },
            body: table.bodies[op.operationId]
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: table.notFoundMessages[op.operationId] });
        expect(sendMailSpy).not.toHaveBeenCalled();
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });

    test.each(badRequestRows)('%s answers 400', async (_, op, param) => {
        const fixtures = await table.createFixtures();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures, { [param]: 'abc' }),
            headers: { 'X-Auth-Token': 'blablabla' },
            body: table.bodies[op.operationId]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(sendMailSpy).not.toHaveBeenCalled();
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });
});
