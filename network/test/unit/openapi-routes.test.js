const path = require('path');
const express = require('express');

const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { instrumentExpress, listExpressRoutes, listSpecOperations } = require('../../../packages/backend-test-utils/routes');
const cron = require('../../lib/cron');

describe('OpenAPI spec completeness', () => {
    let app;

    beforeAll(() => {
        const restore = instrumentExpress(express);
        try {
            // Must load after instrumentExpress() so that the router calls are recorded.
            // eslint-disable-next-line global-require
            ({ server: app } = require('../../lib/server'));
        } finally {
            restore();
        }
    });

    afterAll(() => {
        cron.job.stop();
    });

    test('documents exactly the routes that lib/server.js registers', () => {
        const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
        const routes = listExpressRoutes(app);
        const documented = listSpecOperations(spec);

        expect({
            undocumented: routes.filter((r) => !documented.includes(r)),
            notInExpress: documented.filter((d) => !routes.includes(d))
        }).toEqual({ undocumented: [], notInExpress: [] });
    });
});
