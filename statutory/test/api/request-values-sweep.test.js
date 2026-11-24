const zlib = require('zlib');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');
const {
    spec,
    operations,
    jsonBodyOperations,
    createFixtures,
    pathFor,
    validRequestOf,
    ALL_PERMISSIONS
} = require('../scripts/operations');

const UNREADABLE = { success: false, message: 'The request body could not be read.' };
const NOT_STORABLE = { success: false, message: 'The request body contains characters that cannot be stored.' };
const NOT_AN_OBJECT = { success: false, message: 'The body should be an object.' };
const NOT_A_LIST = { success: false, message: 'The body is not an array.' };

// The one operation that takes a list as its body.
const LIST_BODY = 'setBoardviewApplications';

const nested = (depth, inner) => Array.from({ length: depth }).reduce((value) => [value], inner);

// Values of every kind that a field should never answer 500 for.
const BAD_VALUES = [
    ['the year 0', '0000-01-01'],
    ['a moment in the year 0', '0000-01-01T10:00:00.000Z'],
    ['a moment that is in the year 0 in UTC', '0001-01-01T00:30:00.000+02:00'],
    ['a day that does not exist', '2031-02-30'],
    ['2147483648', 2147483648],
    ['-1', -1],
    ['0', 0],
    ['1.5', 1.5],
    ['1e300', 1e300],
    ['3,000 digits', '1'.repeat(3000)],
    ['a NUL character', 'a\u0000b'],
    ['a NUL character in a list', ['a\u0000b']],
    ['a NUL character in an object', { a: 'a\u0000b' }],
    ['null', null],
    ['true', true],
    ['an empty text', ''],
    ['a long text', 'x'.repeat(300)],
    ['an empty list', []],
    ['an empty object', {}],
    ['a list of objects', [{ a: 1 }]],
    ['a list nested 40 deep', nested(40, 'x')]
];

// The keys of the body of an operation, as its schema in openapi.yaml names them.
const bodyKeys = (schema) => {
    const resolved = schema.$ref ? spec.components.schemas[schema.$ref.split('/').pop()] : schema;
    const keys = Object.keys(resolved.properties || {});
    for (const part of [...(resolved.allOf || []), ...(resolved.oneOf || []), ...(resolved.anyOf || [])]) {
        keys.push(...bodyKeys(part));
    }
    if (resolved.items) {
        keys.push(...bodyKeys(resolved.items));
    }

    return [...new Set(keys)];
};

const label = (operation) => `${operation.method} ${operation.template}`;

// Every operation with a JSON body is swept with bodies that cannot be read, cannot be
// stored or are no object, and with values of every kind in each of its fields; every
// operation with bad values in the query. Nothing answers 500, and each answer is checked
// against openapi.yaml like any other.
describe('Request values', () => {
    let fixtures;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { permissions: ALL_PERMISSIONS } });
        fixtures = await createFixtures();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
        await rimraf(config.images_dir);
    });

    const send = (operation, options) => request({
        path: pathFor(operation, fixtures),
        method: operation.method,
        ...options,
        headers: { 'X-Auth-Token': 'blablabla', ...options.headers }
    });

    const rows = jsonBodyOperations.map((operation) => [label(operation), operation]);

    describe('a whole body', () => {
        test.each(rows)('%s answers 400 for a body that is null, a number, a text or true', async (_, operation) => {
            for (const body of [null, 1, 'text', true]) {
                const res = await send(operation, { body });

                expect({ body, status: res.statusCode, answer: res.body })
                    .toEqual({ body, status: 400, answer: operation.operationId === LIST_BODY ? NOT_A_LIST : NOT_AN_OBJECT });
            }
        });

        test.each(rows)('%s answers for a list as the body as it does for its own body', async (_, operation) => {
            const res = await send(operation, { body: [{ a: 1 }] });

            if (operation.operationId === LIST_BODY) {
                expect(res.statusCode).toEqual(400);
                expect(res.body.success).toEqual(false);
            } else {
                expect(res.statusCode).toEqual(400);
                expect(res.body).toEqual(NOT_AN_OBJECT);
            }
        });

        test.each(rows)('%s answers 413 for a body over 1 MB', async (_, operation) => {
            const res = await send(operation, { rawBody: JSON.stringify({ text: 'x'.repeat(1024 * 1024) }) });

            expect(res.statusCode).toEqual(413);
            expect(res.body).toEqual(UNREADABLE);
        });

        test.each(rows)('%s answers 415 for a charset or an encoding that is not supported', async (_, operation) => {
            for (const headers of [
                { 'Content-Type': 'application/json; charset=bogus' },
                { 'Content-Encoding': 'bogus' }
            ]) {
                const res = await send(operation, { rawBody: '{}', headers });

                expect({ headers, status: res.statusCode, answer: res.body }).toEqual({ headers, status: 415, answer: UNREADABLE });
            }
        });

        test.each(rows)('%s answers 400 for a body that is broken, nested too deeply or not JSON', async (_, operation) => {
            const cases = [
                ['said to be gzip, but not', { rawBody: '{}', headers: { 'Content-Encoding': 'gzip' } }, UNREADABLE],
                ['nested 10,000 levels deep', { rawBody: '{"a":' + '['.repeat(10000) + ']'.repeat(10000) + '}' }, UNREADABLE],
                ['not JSON', { rawBody: '{"a": ' }, { success: false, message: 'Invalid JSON.' }]
            ];

            for (const [description, options, answer] of cases) {
                const res = await send(operation, options);

                expect({ description, status: res.statusCode, answer: res.body }).toEqual({ description, status: 400, answer });
            }
        });

        test.each(rows)('%s reads a body sent with gzip', async (_, operation) => {
            const valid = validRequestOf(operation, fixtures);

            const res = await send(operation, {
                rawBody: zlib.gzipSync(JSON.stringify(valid.body)),
                headers: { 'Content-Encoding': 'gzip' }
            });

            expect(res.statusCode).toBeLessThan(500);
            expect(res.body).not.toEqual(UNREADABLE);
        });

        test.each(rows)('%s answers 400 for characters that cannot be stored, also deep in the body', async (_, operation) => {
            const valid = validRequestOf(operation, fixtures);
            const base = Array.isArray(valid.body) ? valid.body[0] : valid.body;

            for (const extra of [
                { a: 'a\u0000b' },
                { a: ['x', 'a\u0000b'] },
                { a: [{ b: { c: 'a\ud800b' } }] },
                { 'a\u0000b': 1 },
                { a: nested(30, 'a\u0000b') }
            ]) {
                const body = operation.operationId === LIST_BODY ? [{ ...base, ...extra }] : { ...base, ...extra };
                const res = await send(operation, { body });

                expect({ extra, status: res.statusCode, answer: res.body }).toEqual({ extra, status: 400, answer: NOT_STORABLE });
            }
        });
    });

    describe('the fields of a body', () => {
        test.each(rows)('%s answers below 500 for values of every kind in each field', async (_, operation) => {
            const valid = validRequestOf(operation, fixtures);
            const failures = [];

            for (const key of bodyKeys(operation.bodySchema)) {
                for (const [description, value] of BAD_VALUES) {
                    const base = Array.isArray(valid.body) ? valid.body[0] : valid.body;
                    const fields = { ...base, [key]: value };
                    const body = operation.operationId === LIST_BODY ? [fields] : fields;

                    try {
                        const res = await send(operation, { body });

                        if (res.statusCode >= 500) {
                            failures.push(`${key} = ${description}: ${res.statusCode} ${JSON.stringify(res.body)}`);
                        }
                    } catch (err) {
                        // The response check of openapi.yaml: an answer or an accepted body it does not describe.
                        failures.push(`${key} = ${description}: ${err.message.split('\n').slice(1, 3).join(' ')}`);
                    }
                }
            }

            expect(failures).toEqual([]);
        }, 60000);
    });

    describe('the query', () => {
        const QUERIES = [
            'sort[order][]=asc',
            'sort[field][]=id',
            'sort[field]=id&sort[order]=up',
            'limit[]=1',
            'limit=1e300',
            'limit=0',
            'offset=-1',
            'offset=1.5',
            'starts=0000-01-01',
            'ends=2031-02-30',
            'starts=0001-01-01',
            'ends=9999-12-31',
            'starts[]=2031-01-01',
            'search[]=x',
            'search=a%00b',
            'query=a%00b',
            'query[a]=1',
            'type[]=agora&type[]=x',
            'type=a%00b',
            'select=a%00b',
            'select[a]=1',
            'filter[status][]=x',
            'filter=a',
            'displayCancelled=maybe'
        ];

        const getRows = operations
            .filter((operation) => operation.method === 'GET')
            .map((operation) => [label(operation), operation]);

        test.each(getRows)('%s answers below 500 for bad values in the query', async (_, operation) => {
            const failures = [];

            for (const query of QUERIES) {
                let res;
                try {
                    res = await request({
                        path: pathFor(operation, fixtures) + '?' + query,
                        method: 'GET',
                        headers: { 'X-Auth-Token': 'blablabla' },
                        responseType: operation.operationId.startsWith('export') || operation.operationId === 'exportPlenaryStats'
                            ? 'buffer'
                            : 'json'
                    });
                } catch (err) {
                    failures.push(`${query}: ${err.message.split('\n').slice(1, 3).join(' ')}`);
                    continue;
                }

                if (res.statusCode >= 500) {
                    failures.push(`${query}: ${res.statusCode} ${JSON.stringify(res.body)}`);
                }
            }

            expect(failures).toEqual([]);
        });
    });
});
