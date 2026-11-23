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

    // Whatever type a field has, the route answers: with a success if it can use the value,
    // with a 4xx if it can't. Each field is tried on its own, in a body that is valid otherwise.
    describe('a field with a value of another type', () => {
        const VALUES = [5, 1.5, -1, true, false, null, '', 'abc', [], ['a'], [1], {}, { a: 1 }];

        test.each(ROUTES.filter((route) => !route.multipart))('$title never answers with a server error', async (route) => {
            const valid = route.body(data);
            const failures = [];

            for (const field of Object.keys(valid)) {
                for (const value of VALUES) {
                    const res = await send(route, { ...route.body(data), [field]: value });

                    if (res.statusCode >= 500) {
                        failures.push({ field, value, status: res.statusCode, message: res.body.message });
                    }
                }
            }

            expect(failures).toEqual([]);
        });
    });

    // The values that only the database refused: they are validation errors on their field.
    describe('a date, a yes or no, or a choice that is not one', () => {
        const route = (title) => ROUTES.find((item) => item.title === title);

        test.each([
            ['POST /signup/:campaign_id', 'date_of_birth', 'abc'],
            ['POST /signup/:campaign_id', 'date_of_birth', true],
            ['POST /signup/:campaign_id', 'privacy_consent', 'abc'],
            ['POST /signup/:campaign_id', 'privacy_consent', false],
            ['POST /bodies/:body_id/create-member', 'date_of_birth', 'Invalid date'],
            ['PUT /members/:user_id', 'date_of_birth', 'Invalid date'],
            ['PUT /members/:user_id', 'privacy_consent', {}],
            ['PUT /members/:user_id', 'primary_email', 'work'],
            ['PUT /members/:user_id', 'primary_email', ['personal']],
            ['PUT /members/:user_id/active', 'active', [1]],
            ['PUT /members/:user_id/superadmin', 'superadmin', [1]],
            ['POST /bodies', 'founded_at', 'abc'],
            ['POST /bodies', 'pays_fees', 'abc'],
            ['PUT /bodies/:body_id', 'founded_at', 'Invalid date'],
            ['PUT /bodies/:body_id', 'pays_fees', 5],
            ['POST /campaigns', 'active', 'abc'],
            ['POST /campaigns', 'activate_user', null],
            ['PUT /campaigns/:campaign_id', 'activate_user', {}],
            ['POST /bodies/:body_id/campaigns', 'active', []],
            ['PUT /bodies/:body_id/campaigns/:campaign_id', 'activate_user', 'abc'],
            ['POST /permissions', 'filters', 'name'],
            ['POST /permissions', 'filters', [1]],
            ['PUT /permissions/:permission_id', 'filters', { a: 1 }]
        ])('%s answers 422 for %s: %j', async (title, field, value) => {
            const res = await send(route(title), { ...route(title).body(data), [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(Object.keys(res.body.errors)).toEqual([field]);
        });

        test.each([
            ['POST /signup/:campaign_id', 'date_of_birth', null],
            ['POST /signup/:campaign_id', 'privacy_consent', null],
            ['PUT /members/:user_id', 'date_of_birth', ''],
            ['POST /bodies', 'pays_fees', false],
            ['POST /campaigns', 'active', false],
            ['POST /permissions', 'filters', []]
        ])('%s still accepts %s: %j', async (title, field, value) => {
            const res = await send(route(title), { ...route(title).body(data), [field]: value });

            expect(res.statusCode).toEqual(200);
        });
    });
});
