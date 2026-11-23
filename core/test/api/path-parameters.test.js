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

// An ID that nothing has: the highest one the database can hold.
const NONEXISTENT_ID = '2147483647';

// Values that are not the ID of anything, although some look like a number to JavaScript.
const NOT_AN_ID = ['abc', '1.5', '-1', '1e3', '0x10', 'Infinity', '2147483648', '99999999999999999999'];

// What each parameter in a path stands for. `name`: the route also takes a name there (a
// username, a body code or the URL of a campaign), so a value that is not an ID is looked up
// as a name and not found. Without it, a value that is not an ID answers 400.
const PARAMETERS = {
    user_id: { name: true, notFound: 'User is not found.' },
    body_id: { name: true, notFound: 'Body is not found.' },
    circle_id: { notFound: 'Circle is not found.', invalid: 'Circle ID is invalid.' },
    permission_id: { notFound: 'Permission is not found.', invalid: 'Permission ID is invalid.' },
    campaign_id: { name: true, notFound: 'Campaign is not found.' },
    membership_id: { notFound: 'Membership is not found.', invalid: 'Membership ID is invalid.' },
    request_id: { notFound: 'Join request is not found.', invalid: 'Join request ID is invalid.' },
    payment_id: { notFound: 'Payment is not found.', invalid: 'Payment ID is invalid.' },
    category_id: { notFound: 'Section is not found.', invalid: 'Section ID is invalid.' },
    link_id: { notFound: 'Link is not found.', invalid: 'Link ID is invalid.' }
};

// The same parameter names with another meaning on two groups of routes.
const parameterOf = (operation, name) => {
    // A campaign of a body is addressed by its ID only.
    if (name === 'campaign_id' && operation.template.startsWith('/bodies/')) {
        return { notFound: 'Campaign is not found.', invalid: 'Campaign ID is invalid.' };
    }

    // A permission of a circle is looked up among the permissions of that circle.
    if (name === 'permission_id' && operation.template.startsWith('/circles/')) {
        return { notFound: 'The permission does not belong to this circle.', invalid: 'The permission ID is not valid.' };
    }

    return PARAMETERS[name];
};

// One row per parameter of every operation that has one.
const rows = OPERATIONS.flatMap((operation) => operation.pathParams.map((name) => ({
    operation,
    name,
    parameter: parameterOf(operation, name),
    title: `${operation.title} (${name})`
})));

describe('Path parameters', () => {
    let data;
    let before;

    // No request here finds what its path names, so the fixtures are made once.
    // The caller is a superadmin who holds every permission: only the path decides the answer.
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

    const send = (operation, name, value) => request({
        path: buildPath(operation, data, { [name]: value }),
        method: operation.method,
        headers: { 'X-Auth-Token': data.token.value },
        body: operation.body ? operation.body(data) : undefined
    });

    test('covers every parameter of every route', () => {
        expect(rows.length).toEqual(85);
        expect([...new Set(rows.map((row) => row.name))].sort()).toEqual(Object.keys(PARAMETERS).sort());
    });

    test.each(rows)('$title answers 404 for an ID that nothing has', async ({ operation, name, parameter }) => {
        const res = await send(operation, name, NONEXISTENT_ID);

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: parameter.notFound });
        expect(await snapshot()).toEqual(before);
    });

    test.each(rows.filter((row) => row.parameter.name))('$title answers 404 for a name that nothing has', async ({ operation, name, parameter }) => {
        for (const value of [...NOT_AN_ID, 'unknown-name']) {
            const res = await send(operation, name, value);

            expect({ value, status: res.statusCode, body: res.body })
                .toEqual({ value, status: 404, body: { success: false, message: parameter.notFound } });
        }

        expect(await snapshot()).toEqual(before);
    });

    test.each(rows.filter((row) => !row.parameter.name))('$title answers 400 for a value that is not an ID', async ({ operation, name, parameter }) => {
        for (const value of NOT_AN_ID) {
            const res = await send(operation, name, value);

            expect({ value, status: res.statusCode, body: res.body })
                .toEqual({ value, status: 400, body: { success: false, message: parameter.invalid } });
        }

        expect(await snapshot()).toEqual(before);
    });

    // The routes under a body take its code as well as its ID, in any case.
    describe('a body addressed by its code', () => {
        const underBody = OPERATIONS.filter((operation) => operation.template.startsWith('/bodies/{body_id}') && operation.method === 'GET');

        test.each(underBody)('$title answers like for the ID', async (operation) => {
            const withId = await request({
                path: buildPath(operation, data),
                headers: { 'X-Auth-Token': data.token.value }
            });
            const withCode = await request({
                path: buildPath(operation, data, { body_id: data.body.code.toLowerCase() }),
                headers: { 'X-Auth-Token': data.token.value }
            });

            expect(withId.statusCode).toEqual(200);
            expect(withCode.statusCode).toEqual(200);
            expect(withCode.body).toEqual(withId.body);
        });

        // These change what is stored, so they come after the rows above. Setting the status
        // is left out: it would delete the body under the other rows.
        const changes = OPERATIONS.filter((operation) => operation.template.startsWith('/bodies/{body_id}')
            && operation.method === 'PUT'
            && operation.operationId !== 'setBodyStatus');

        test.each(changes)('$title works like for the ID', async (operation) => {
            // The row that updates the body gives it another code.
            await data.body.reload();

            const res = await request({
                path: buildPath(operation, data, { body_id: data.body.code }),
                method: 'PUT',
                headers: { 'X-Auth-Token': data.token.value },
                body: operation.body(data)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
        });

        test('a membership of another body is not found', async () => {
            const operation = OPERATIONS.find((item) => item.operationId === 'getBodyMembership');

            const res = await request({
                path: buildPath(operation, data, { body_id: data.otherBody.code }),
                headers: { 'X-Auth-Token': data.token.value }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Membership is not found.' });
        });
    });
});
