const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

// Every operation with a path parameter, taken from openapi.yaml. The caller is a
// discounts manager and a member of an antenna, so only the path decides the answer.
const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = listOperations(spec).filter((operation) => operation.pathParams.length > 0);

const bodies = {
    addIntegrationCodes: () => ['NEW-CODE'],
    updateIntegration: () => ({ name: 'New name' }),
    updateCategory: () => ({ name: 'New name' })
};

const rows = (paramName, values) => operations
    .filter((operation) => operation.pathParams.includes(paramName))
    .flatMap((operation) => values.map((value) => [`${operation.method} ${operation.template}`, value, operation]));

const requestFor = (operation, paramName, value) => {
    const body = bodies[operation.operationId];
    return request({
        path: operation.template.replace(`{${paramName}}`, encodeURIComponent(value)),
        method: operation.method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body: body ? body() : undefined
    });
};

describe('Path parameters', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();

        // Something to find, so that a 404 is about the value in the path.
        const integration = await generator.createIntegration({ code: 'existing' });
        await generator.createCode({}, integration);
        await generator.createCategory();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('covers the integration and category routes', () => {
        expect(operations.map((operation) => operation.operationId).sort()).toEqual([
            'addIntegrationCodes',
            'claimIntegrationCode',
            'deleteCategory',
            'deleteIntegration',
            'getCategory',
            'getIntegration',
            'updateCategory',
            'updateIntegration'
        ]);
    });

    // integration_id is an id when it is all digits, otherwise a code.
    test.each(rows('integration_id', ['1337', 'unknown-code', '2147483648']))(
        '%s answers 404 for the integration %s',
        async (_, value, operation) => {
            const res = await requestFor(operation, 'integration_id', value);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('The integration is not found.');
        }
    );

    test.each(rows('category_id', ['1337']))(
        '%s answers 404 for the category %s',
        async (_, value, operation) => {
            const res = await requestFor(operation, 'category_id', value);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('The category is not found.');
        }
    );

    test.each(rows('category_id', ['abc', '1.5', '-1', '2147483648']))(
        '%s answers 400 for the category id %s',
        async (_, value, operation) => {
            const res = await requestFor(operation, 'category_id', value);

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('The category ID is not a number.');
        }
    );
});
