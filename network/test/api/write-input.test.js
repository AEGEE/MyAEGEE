const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { AntennaCriterion, Netcom, MailComponent } = require('../../models');

// The upserts of NetCom assignments, mail texts and Antenna Criteria take only their own
// fields, check them all before storing, and refuse a body that is not an object.
const PAST = '2000-01-01T00:00:00.000Z';

const routes = {
    netcom: {
        path: '/netcom',
        model: Netcom,
        valid: () => ({ body_id: 34, netcom_id: 7 }),
        required: [
            ['body_id', 'Body should be set.'],
            ['netcom_id', 'NetCom should be set.']
        ]
    },
    mailComponent: {
        path: '/mailComponent',
        model: MailComponent,
        valid: () => ({ agora_id: 5, mail_component: 'closing', text: 'Best regards' }),
        required: [
            ['agora_id', 'Agora should be set.'],
            ['text', 'Text should be set.']
        ]
    },
    antennaCriteria: {
        path: '/antennaCriteria',
        model: AntennaCriterion,
        valid: () => ({ agora_id: 5, body_id: 34, antenna_criterion: 'events', value: 'true' }),
        required: [
            ['agora_id', 'Agora should be set.'],
            ['body_id', 'Body should be set.']
        ]
    }
};

const put = (route, body) => request({
    path: route.path,
    method: 'PUT',
    headers: { 'X-Auth-Token': 'blablabla' },
    body
});

describe('Input of the upserts', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    describe.each(Object.entries(routes))('PUT %s', (_, route) => {
        test.each(route.required)('should answer 422 with a message if %s is missing', async (field, message) => {
            const body = route.valid();
            delete body[field];

            const res = await put(route, body);

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect(await route.model.count()).toEqual(0);
        });

        test('should answer 422 with a message per field if several are missing', async () => {
            const body = route.valid();
            for (const [field] of route.required) delete body[field];

            const res = await put(route, body);

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual(Object.fromEntries(route.required.map(([field, message]) => [field, [message]])));
        });

        test.each(['created_at', 'updated_at'])('should ignore a malformed %s', async (field) => {
            const res = await put(route, { ...route.valid(), [field]: 'garbage' });

            expect(res.statusCode).toEqual(200);
            expect(await route.model.count()).toEqual(1);
        });

        test('should keep its own timestamps on create', async () => {
            const res = await put(route, { ...route.valid(), created_at: PAST, updated_at: PAST });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.created_at).not.toEqual(PAST);
            expect(res.body.data.updated_at).not.toEqual(PAST);

            const [row] = await route.model.findAll();
            expect(row.created_at.toISOString()).not.toEqual(PAST);
            expect(row.updated_at.toISOString()).not.toEqual(PAST);
        });

        test('should keep its own timestamps on update', async () => {
            expect((await put(route, route.valid())).statusCode).toEqual(200);

            const res = await put(route, { ...route.valid(), updated_at: PAST });

            expect(res.statusCode).toEqual(200);
            const [row] = await route.model.findAll();
            expect(row.updated_at.toISOString()).not.toEqual(PAST);
        });

        test('should refuse a list as the body with 400', async () => {
            const res = await put(route, [route.valid()]);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'The body should be an object.' });
            expect(await route.model.count()).toEqual(0);
        });
    });

    describe('values that are not a single value', () => {
        test.each([
            ['netcom', 'body_id', [34], 'Body ID should be a number.'],
            ['netcom', 'netcom_id', { id: 7 }, 'NetCom ID should be a number.'],
            ['netcom', 'netcom_id', [7], 'NetCom ID should be a number.'],
            ['mailComponent', 'agora_id', [5], 'Agora ID should be a number.'],
            ['antennaCriteria', 'agora_id', [5], 'Agora ID should be a number.'],
            ['antennaCriteria', 'body_id', { id: 34 }, 'Body ID should be a number.'],
            ['antennaCriteria', 'value', ['true'], 'Value must be one of these: "true", "false", "exception", or null.']
        ])('PUT %s should refuse %s set to %p with 422', async (name, field, value, message) => {
            const route = routes[name];

            const res = await put(route, { ...route.valid(), [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect(await route.model.count()).toEqual(0);
        });
    });
});
