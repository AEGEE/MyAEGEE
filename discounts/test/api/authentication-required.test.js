const path = require('path');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { listOperations } = require('../../../packages/backend-test-utils/routes');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Integration, Code, Category } = require('../../models');

// Every operation that the spec marks as needing a token, taken from openapi.yaml, so a
// new route gets its 401 rows without anyone writing them.
const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = listOperations(spec).filter((operation) => operation.auth === 'required');

// A body the operation would accept, so that only the missing or rejected token stops it.
const bodies = {
    createIntegration: () => generator.generateIntegration({ code: 'new-integration' }),
    addIntegrationCodes: () => ['NEW-CODE'],
    updateIntegration: () => ({ name: 'New name' }),
    createCategory: () => generator.generateCategory(),
    updateCategory: () => ({ name: 'New name' })
};

// What the service stores, to show that a refused request changed nothing.
const snapshot = async () => ({
    integrations: await Integration.findAll({ order: [['id', 'ASC']], raw: true }),
    codes: await Code.findAll({ order: [['id', 'ASC']], raw: true }),
    categories: await Category.findAll({ order: [['id', 'ASC']], raw: true })
});

describe('Authentication required', () => {
    let pathValues;

    beforeEach(async () => {
        mock.mockAll();
        await startServer();

        const integration = await generator.createIntegration({ code: 'existing', quota_amount: 1 });
        await generator.createCode({}, integration);
        const category = await generator.createCategory();
        pathValues = { integration_id: integration.id, category_id: category.id };
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    const requestFor = (operation, headers) => {
        const urlPath = operation.template.replace(/\{(\w+)\}/g, (_, name) => pathValues[name]);
        const body = bodies[operation.operationId];
        return request({
            path: urlPath,
            method: operation.method,
            headers,
            body: body ? body() : undefined
        });
    };

    test('covers every route except the health check and the metrics', () => {
        expect(operations.map((operation) => operation.operationId).sort()).toEqual([
            'addIntegrationCodes',
            'claimIntegrationCode',
            'createCategory',
            'createIntegration',
            'deleteCategory',
            'deleteIntegration',
            'getCategory',
            'getIntegration',
            'listCategories',
            'listIntegrations',
            'listMyCodes',
            'updateCategory',
            'updateIntegration'
        ]);
    });

    test.each(operations.map((operation) => [`${operation.method} ${operation.template}`, operation]))(
        '%s answers 401 without a token and does not ask core',
        async (_, operation) => {
            const { omsCoreStub, omsMainPermissionsStub } = mock.mockAll();
            const before = await snapshot();

            const res = await requestFor(operation, {});

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('No auth token provided');
            expect(omsCoreStub.isDone()).toEqual(false);
            expect(omsMainPermissionsStub.isDone()).toEqual(false);
            expect(await snapshot()).toEqual(before);
        }
    );

    test.each(operations.map((operation) => [`${operation.method} ${operation.template}`, operation]))(
        '%s answers 401 when core rejects the token',
        async (_, operation) => {
            mock.mockAll({ core: { unauthorized: true } });
            const before = await snapshot();

            const res = await requestFor(operation, { 'X-Auth-Token': 'rejected' });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Error fetching user: user is not authenticated.');
            expect(await snapshot()).toEqual(before);
        }
    );
});
