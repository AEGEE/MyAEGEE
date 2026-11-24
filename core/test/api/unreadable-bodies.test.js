const path = require('path');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const { createContract } = require('../../../packages/backend-test-utils/openapi');
const { OPERATIONS } = require('../scripts/route-table');

// Every operation with a JSON request body. The server reads the body before any route,
// so each of them answers the same for a body it cannot read or store, without a login.
const { spec } = createContract({ serviceRoot: path.join(__dirname, '..', '..') });
const operations = OPERATIONS.filter((operation) => {
    const { requestBody } = spec.paths[operation.template][operation.method.toLowerCase()];
    return requestBody && requestBody.content['application/json'];
});

const UNREADABLE = { success: false, message: 'The request body could not be read.' };
const WITH_NUL = { success: false, message: 'Texts in the request body cannot contain the character U+0000.' };

describe('Request bodies that the server cannot read', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    // The ids do not matter: nothing gets as far as looking them up.
    const send = (operation, options) => request({
        path: operation.template.replace(/\{\w+\}/g, '1'),
        method: operation.method,
        ...options
    });

    test('covers every operation with a JSON body', () => {
        expect(operations.length).toEqual(46);
    });

    test.each(operations)('$title answers 413 for a body over 100 kB', async (operation) => {
        const res = await send(operation, { rawBody: JSON.stringify({ text: 'x'.repeat(101 * 1024) }) });

        expect(res.statusCode).toEqual(413);
        expect(res.body).toEqual(UNREADABLE);
    });

    test.each(operations)('$title answers 415 for another charset and for an unknown encoding', async (operation) => {
        const charset = await send(operation, {
            headers: { 'Content-Type': 'application/json; charset=latin1' },
            rawBody: '{}'
        });
        const encoding = await send(operation, {
            headers: { 'Content-Encoding': 'compress' },
            rawBody: '{}'
        });

        expect([charset.statusCode, charset.body]).toEqual([415, UNREADABLE]);
        expect([encoding.statusCode, encoding.body]).toEqual([415, UNREADABLE]);
    });

    test.each(operations)('$title answers 400 for a text with the character U+0000', async (operation) => {
        const res = await send(operation, { body: { text: 'a\u0000b' } });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual(WITH_NUL);
    });

    test.each(operations)('$title answers 400 for the character U+0000 at the bottom of a body nested 10,000 levels deep', async (operation) => {
        const depth = 10000;
        const res = await send(operation, { rawBody: '{"a":'.repeat(depth) + '"a\\u0000b"' + '}'.repeat(depth) });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual(WITH_NUL);
    });
});
