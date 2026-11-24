const { default: nock } = require('nock');

const { startServer, stopServer } = require('../../lib/server');
const login = require('../../middlewares/login');
const { rateLimitStore } = require('../../middlewares/bug-report');
const config = require('../../config');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { ROUTES, createFixtures } = require('../scripts/body-routes');

// Each sweep sends a few hundred requests per route, and every response is checked against the
// OpenAPI file; a shared runner takes longer than the default 5 seconds for the slowest route.
jest.setTimeout(60 * 1000);

describe('Request bodies', () => {
    let data;

    const send = (route, body) => request({
        path: route.path(data),
        method: route.method,
        headers: { 'X-Auth-Token': data.token.value },
        body
    });

    // For the sweeps that send whatever a client should not send. The server takes some of it
    // (a number where a text belongs is stored as a text), which the request check of the
    // OpenAPI file would report: that file says what a client should send. The response is
    // still checked.
    const sendUnusual = (route, body) => request({
        path: route.path(data),
        method: route.method,
        headers: { 'X-Auth-Token': data.token.value },
        body,
        skipRequestCheck: 'the sweep sends values a client should not send'
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

        // Not the routes that take no fields: a body is not for them.
        test.each(ROUTES.filter((route) => !route.multipart && !route.noFields))('$title answers the same for an empty JSON object', async (route) => {
            const res = await send(route, {});

            expect(res.statusCode).toEqual(route.noBody);
        });

        // A list has no fields either. One route stands for all: the body is replaced before any route sees it.
        test('POST /circles answers the same for a JSON list', async () => {
            const route = ROUTES.find((item) => item.title === 'POST /circles');
            const res = await send(route, []);

            expect(res.statusCode).toEqual(route.noBody);
        });
    });

    // Whatever type a field has, the route answers: with a success if it can use the value,
    // with a 4xx if it can't. Each field is tried on its own, in a body that is valid otherwise.
    describe('a field with a value of another type', () => {
        const VALUES = [
            5, true, null, '', 'abc', [1], { a: 1 },
            2147483648, -1, 0, 1.5, 1e300, 12345678,
            '0000-01-01', '0000-01-01T00:00:00Z', '2001-02-30',
            Array(300).fill('a'), ['a'.repeat(300)], ['\u0000']
        ];

        test.each(ROUTES.filter((route) => !route.multipart))('$title never answers with a server error', async (route) => {
            const valid = route.body(data);
            const failures = [];

            for (const field of Object.keys(valid)) {
                for (const value of VALUES) {
                    const res = await sendUnusual(route, { ...route.body(data), [field]: value });

                    if (res.statusCode >= 500) {
                        failures.push({ field, value, status: res.statusCode, message: res.body.message });
                    }
                }
            }

            expect(failures).toEqual([]);
        });
    });

    // A value nested 10,000 levels deep, as an object and as a list, in each field and in a
    // field that the route does not know.
    describe('a value nested 10,000 levels deep', () => {
        const DEPTH = 10000;
        const DEEP_VALUES = {
            object: '{"a":'.repeat(DEPTH) + '"text"' + '}'.repeat(DEPTH),
            list: '['.repeat(DEPTH) + '"text"' + ']'.repeat(DEPTH)
        };

        test.each(ROUTES.filter((route) => !route.multipart))('$title never answers with a server error', async (route) => {
            // With a field it does not know, the subscription to a mailing list goes out.
            nock(config.listserv_endpoint).persist().post('').reply(200, 'OK');
            const failures = [];

            for (const field of [...Object.keys(route.body(data)), 'unknown_field']) {
                for (const [kind, deep] of Object.entries(DEEP_VALUES)) {
                    const rawBody = JSON.stringify({ ...route.body(data), [field]: 'DEEP' }).replace('"DEEP"', deep);
                    const res = await request({
                        path: route.path(data),
                        method: route.method,
                        headers: { 'X-Auth-Token': data.token.value },
                        rawBody,
                        skipRequestCheck: 'the sweep sends values a client should not send'
                    });

                    if (res.statusCode >= 500) {
                        failures.push({ field, kind, status: res.statusCode, message: res.body.message });
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

    // A text that is longer than its column.
    describe('a text of 300 characters', () => {
        const LONG = 'a'.repeat(300);
        const variants = (field) => [LONG, `${LONG}@example.com`, `https://example.com/${LONG}`]
            .map((value) => ({ field, value }));

        test.each(ROUTES.filter((route) => !route.multipart))('$title never answers with a server error', async (route) => {
            const valid = route.body(data);
            const failures = [];

            for (const { field, value } of Object.keys(valid).flatMap(variants)) {
                const res = await sendUnusual(route, { ...route.body(data), [field]: value });

                if (res.statusCode >= 500) {
                    failures.push({ field, value: value.slice(0, 20), status: res.statusCode, message: res.body.message });
                }
            }

            expect(failures).toEqual([]);
        });

        // One column per model.
        test.each([
            ['PUT /members/:user_id', 'first_name', 'First name should be at most 255 characters long.'],
            ['POST /bodies', 'name', 'Name should be at most 255 characters long.'],
            ['POST /circles', 'name', 'Name should be at most 255 characters long.'],
            ['POST /permissions', 'action', 'Action should be at most 255 characters long.'],
            ['POST /campaigns', 'url', 'Url should be at most 255 characters long.'],
            ['POST /bodies/:body_id/payments', 'currency', 'Currency should be at most 255 characters long.'],
            ['POST /resources/links', 'title', 'Title should be at most 100 characters long.']
        ])('%s answers 422 for a %s that is too long', async (title, field, message) => {
            const route = ROUTES.find((item) => item.title === title);
            const res = await send(route, { ...route.body(data), [field]: LONG });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { [field]: [message] } });
        });

        test('PUT /members/:user_id accepts a text of exactly the length of its column', async () => {
            const route = ROUTES.find((item) => item.title === 'PUT /members/:user_id');
            const res = await send(route, { ...route.body(data), phone: '1'.repeat(255) });

            expect(res.statusCode).toEqual(200);
        });
    });

    // The server takes a number where a text belongs and stores it as a text. The answer
    // shows what is stored, not what was sent.
    describe('a number where a text belongs', () => {
        test.each(ROUTES.filter((route) => !route.multipart))('$title answers with what is stored', async (route) => {
            const valid = route.body(data);
            const wrong = [];

            for (const field of Object.keys(valid).filter((key) => typeof valid[key] === 'string')) {
                const res = await sendUnusual(route, { ...route.body(data), [field]: 5 });
                const answered = res.statusCode === 200 && res.body.data ? res.body.data[field] : undefined;

                if (typeof answered !== 'undefined' && typeof answered !== 'string') {
                    wrong.push({ field, answered });
                }
            }

            expect(wrong).toEqual([]);
        });

        test('PUT /bodies/:body_id/members/:membership_id still answers with the member and their computed fields', async () => {
            const route = ROUTES.find((item) => item.title === 'PUT /bodies/:body_id/members/:membership_id');

            const res = await send(route, { comment: 'A comment' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.comment).toEqual('A comment');
            expect(res.body.data.user).toEqual(expect.objectContaining({
                id: data.member.id,
                email: 'member@example.com',
                notification_email: 'member@example.com'
            }));
            expect(res.body.data.user).not.toHaveProperty('password');
        });
    });

    // A date comes as a date (2020-01-31) or as a full ISO timestamp. Nothing else is read
    // as one: not a number, and not a text that only looks like a date to a lenient parser.
    describe('a date in another notation', () => {
        const DATE_FIELDS = [
            ['POST /signup/:campaign_id', 'date_of_birth'],
            ['POST /signup/:campaign_id', 'privacy_consent'],
            ['PUT /members/:user_id', 'date_of_birth'],
            ['PUT /members/:user_id', 'privacy_consent'],
            ['POST /bodies/:body_id/create-member', 'date_of_birth'],
            ['POST /bodies', 'founded_at'],
            ['PUT /bodies/:body_id', 'founded_at'],
            ['POST /bodies/:body_id/payments', 'starts'],
            ['PUT /bodies/:body_id/payments/:payment_id', 'starts']
        ];

        // The end of a payment is also checked against its start, so it is only refused here.
        const REFUSING_FIELDS = [
            ...DATE_FIELDS,
            ['POST /bodies/:body_id/payments', 'expires'],
            ['PUT /bodies/:body_id/payments/:payment_id', 'expires']
        ];

        test.each(REFUSING_FIELDS)('%s refuses a %s that is not an ISO date', async (title, field) => {
            const route = ROUTES.find((item) => item.title === title);

            for (const value of [1, '1', '2001', '12/31/2001', '31-12-2001', 'January 1, 2001', '2001-13-45', '2001-02-30', '0000-01-01', '0000-01-01T00:00:00Z', '2001-01-01 10:00', true]) {
                const res = await sendUnusual(route, { ...route.body(data), [field]: value });

                expect({ value, status: res.statusCode, fields: Object.keys(res.body.errors || {}) })
                    .toEqual({ value, status: 422, fields: [field] });
            }
        });

        const ISO_VALUES = ['2001-01-31', '2001-01-31T10:00:00.000Z', '2001-01-31T10:00:00+01:00'];

        test.each(DATE_FIELDS.flatMap(([title, field]) => ISO_VALUES.map((value) => [title, field, value])))(
            '%s takes a %s like %s',
            async (title, field, value) => {
                const route = ROUTES.find((item) => item.title === title);

                const res = await sendUnusual(route, { ...route.body(data), [field]: value });

                expect(res.statusCode).toEqual(200);
            }
        );
    });
});
