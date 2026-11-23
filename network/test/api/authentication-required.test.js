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
const operations = listOperations(spec).filter((op) => op.auth === 'required');

describe('Authentication required', () => {
    let sendMailSpy;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        sendMailSpy = jest.spyOn(mailer, 'sendMail');
    });

    afterEach(async () => {
        sendMailSpy.mockRestore();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('every authenticated operation has a row in route-table.js', () => {
        expect(operations.map((op) => op.operationId).filter((id) => !table.paths[id])).toEqual([]);
    });

    test.each(operations.map((op) => [`${op.method} ${op.template}`, op]))('%s answers 401 without a token, before asking core', async (_, op) => {
        const fixtures = await table.createFixtures();
        // No core mocks: a call to core would fail the request with a 500.
        mock.cleanAll();

        const res = await request({ method: op.method, path: table.paths[op.operationId](fixtures), body: table.bodies[op.operationId] });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(sendMailSpy).not.toHaveBeenCalled();
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });

    test.each(operations.map((op) => [`${op.method} ${op.template}`, op]))('%s answers 401 if core rejects the token', async (_, op) => {
        const fixtures = await table.createFixtures();
        table.asAnonymous();

        const res = await request({
            method: op.method,
            path: table.paths[op.operationId](fixtures),
            headers: { 'X-Auth-Token': 'blablabla' },
            body: table.bodies[op.operationId]
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(sendMailSpy).not.toHaveBeenCalled();
        if (table.unchanged[op.operationId]) await table.unchanged[op.operationId](fixtures);
    });
});
