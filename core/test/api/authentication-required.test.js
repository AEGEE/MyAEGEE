const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const {
    OPERATIONS,
    createFixtures,
    buildPath,
    snapshot
} = require('../scripts/route-table');

// Every operation that openapi.yaml marks as needing a token.
const operations = OPERATIONS.filter((operation) => operation.auth === 'required');

const NOT_AUTHORIZED = { success: false, message: 'You are not authorized.' };

describe('Authentication required', () => {
    let data;
    let before;

    // No request here gets past the check for a token, so the fixtures are made once.
    beforeAll(async () => {
        await startServer();
        mock.mockAll();
        data = await createFixtures();
        before = await snapshot();
    });

    afterAll(async () => {
        mock.cleanAll();
        await generator.clearAll();
        await stopServer();
    });

    const send = (operation, headers) => request({
        path: buildPath(operation, data),
        method: operation.method,
        headers,
        body: operation.body ? operation.body(data) : undefined
    });

    test('covers every route but the public ones', () => {
        const others = OPERATIONS.filter((operation) => operation.auth !== 'required').map((operation) => operation.title);

        expect(operations.length).toEqual(85);
        expect(others.sort()).toEqual([
            'GET /bodies',
            'GET /bodies/{body_id}',
            'GET /campaigns/{campaign_id}',
            'GET /healthcheck',
            'GET /metrics',
            'GET /metrics/requests',
            'POST /bug-report',
            'POST /confirm-email',
            'POST /confirm-email-change',
            'POST /login',
            'POST /logout',
            'POST /password_confirm',
            'POST /password_reset',
            'POST /renew',
            'POST /signup/{campaign_id}'
        ]);
    });

    test.each(operations)('$title answers 401 without a token', async (operation) => {
        const res = await send(operation, {});

        expect(res.statusCode).toEqual(401);
        expect(res.body).toEqual(NOT_AUTHORIZED);
        expect(await snapshot()).toEqual(before);
    });

    // The three ways a token is not one, on a read, a write and a route that reads the member in the path.
    describe.each([
        ['GET /my_permissions'],
        ['PUT /bodies/{body_id}'],
        ['PUT /members/{user_id}/password']
    ])('%s', (title) => {
        const operation = operations.find((item) => item.title === title);

        test('answers 401 for a token that does not exist', async () => {
            const res = await send(operation, { 'X-Auth-Token': 'not-a-token' });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual(NOT_AUTHORIZED);
            expect(await snapshot()).toEqual(before);
        });

        test('answers 401 for a token that is expired', async () => {
            const expired = await generator.createAccessToken(data.admin, { expires_at: new Date(Date.now() - 1000) });

            const res = await send(operation, { 'X-Auth-Token': expired.value });
            await expired.destroy();

            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual(NOT_AUTHORIZED);
            expect(await snapshot()).toEqual(before);
        });

        test('answers 401 for the token of a suspended member', async () => {
            const suspended = await generator.createUser({ superadmin: true, active: false });
            const token = await generator.createAccessToken(suspended);

            const res = await send(operation, { 'X-Auth-Token': token.value });
            await suspended.destroy();

            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual(NOT_AUTHORIZED);
            expect(await snapshot()).toEqual(before);
        });
    });
});
