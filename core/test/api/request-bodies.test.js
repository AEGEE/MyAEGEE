const { startServer, stopServer } = require('../../lib/server');
const login = require('../../middlewares/login');
const { rateLimitStore } = require('../../middlewares/bug-report');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { ROUTES, createFixtures } = require('../scripts/body-routes');

describe('Request bodies', () => {
    let data;

    const send = (route, body) => request({
        path: route.path(data),
        method: route.method,
        headers: { 'X-Auth-Token': data.token.value },
        body
    });

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        rateLimitStore.resetAll();
        data = await createFixtures();
    });

    afterEach(async () => {
        await login.waitForPasswordResets();
        await generator.clearAll();
        mock.cleanAll();
    });

    describe('a request without any body', () => {
        test.each(ROUTES)('$title answers $noBody', async (route) => {
            const res = await send(route);

            expect({ status: res.statusCode, body: res.body }).toEqual({ status: route.noBody, body: expect.any(Object) });
            expect(res.body.success).toEqual(route.noBody === 200);
        });

        test.each(ROUTES.filter((route) => !route.multipart))('$title answers the same for an empty JSON object', async (route) => {
            const res = await send(route, {});

            expect(res.statusCode).toEqual(route.noBody);
        });

        test.each(ROUTES.filter((route) => !route.multipart))('$title answers the same for a JSON list', async (route) => {
            const res = await send(route, []);

            expect(res.statusCode).toEqual(route.noBody);
        });
    });
});
