// The spec rules that createContract() enforces when it loads a spec, and that
// spec-lint.js enforces in CI: closed response schemas, x-free-form, the Todo
// placeholder, statuses one by one and the place of x-untested.
const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { createContract } = require('../openapi');
const { REQUIRE_FROM, minimalSpec, writeSpec } = require('./helpers');

const JSON_HEADERS = { 'content-type': 'application/json' };
const SCHEMA = '#/paths/~1x/get/responses/200/content/application~1json/schema';
const load = (spec, options = {}) => createContract({ serviceRoot: writeSpec(spec), requireFrom: REQUIRE_FROM, ...options });
const loads = (spec, options) => assert.doesNotThrow(() => load(spec, options));
const rejects = (spec, ...patterns) => assert.throws(() => load(spec), (err) => {
    assert.match(err.message, /OpenAPI convention problem\(s\)/);
    for (const pattern of patterns) assert.match(err.message, pattern);
    return true;
});
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "GET /x 200 (getX): #<pointer>: <message>"
const at = (pointer, message) => new RegExp(`GET /x 200 \\(getX\\): ${escape(pointer)}: ${message}`);

const closed = (properties) => ({ type: 'object', properties, additionalProperties: false });

describe('closed response schemas', () => {
    test('an empty schema fails', () => {
        rejects(minimalSpec({ schema: {} }), at(SCHEMA, 'empty schema accepts any value'));
        rejects(minimalSpec({ schema: { description: 'anything' } }), at(SCHEMA, 'empty schema'));
    });

    test('a JSON response without a schema fails', () => {
        rejects(
            minimalSpec({ content: { 'application/json': {} } }),
            at('#/paths/~1x/get/responses/200/content/application~1json', 'a JSON response needs a schema')
        );
    });

    test('type: object without additionalProperties or unevaluatedProperties fails', () => {
        rejects(minimalSpec({ schema: { type: 'object', properties: { a: { type: 'string' } } } }), at(SCHEMA, 'object schema is not closed'));
    });

    test('additionalProperties: true and additionalProperties: {} are explicitly open', () => {
        rejects(minimalSpec({ schema: { type: 'object', additionalProperties: true } }), at(SCHEMA, 'object schema is explicitly open'));
        rejects(minimalSpec({ schema: { type: 'object', additionalProperties: {} } }), at(SCHEMA, 'object schema is explicitly open'));
    });

    test('a nested object must be closed too', () => {
        const schema = closed({ data: { type: 'object', properties: { a: { type: 'string' } } } });
        rejects(minimalSpec({ schema }), at(`${SCHEMA}/properties/data`, 'object schema is not closed'));
    });

    test('a schema without a type or a composition keyword fails', () => {
        rejects(minimalSpec({ schema: closed({ a: { minLength: 1 } }) }), at(`${SCHEMA}/properties/a`, 'schema has no type'));
    });

    test('object keywords need type: object next to them (Ajv strict mode)', () => {
        const Fields = { type: 'object', properties: { id: { type: 'integer' } } };
        rejects(
            minimalSpec({ schema: { allOf: [{ $ref: '#/components/schemas/Fields' }], unevaluatedProperties: false }, schemas: { Fields } }),
            at(SCHEMA, 'uses unevaluatedProperties without type: object; add the type')
        );
        rejects(minimalSpec({ schema: { properties: { a: { type: 'string' } }, additionalProperties: false } }), at(SCHEMA, 'uses properties, additionalProperties without type: object'));
    });

    test('const and enum count as a type', () => {
        loads(minimalSpec({ schema: closed({ success: { const: true }, status: { enum: ['a', 'b'] } }) }));
    });

    test('an array needs items, and its items are checked', () => {
        rejects(minimalSpec({ schema: closed({ list: { type: 'array' } }) }), at(`${SCHEMA}/properties/list`, 'array schema has no items'));
        rejects(
            minimalSpec({ schema: closed({ list: { type: 'array', items: { type: 'object' } } }) }),
            at(`${SCHEMA}/properties/list/items`, 'object schema is not closed')
        );
        rejects(minimalSpec({ schema: closed({ list: { type: 'array', items: {} } }) }), at(`${SCHEMA}/properties/list/items`, 'empty schema'));
    });

    test('a problem in a shared component names the component and the first operation that uses it, once', () => {
        const spec = minimalSpec({ schema: { $ref: '#/components/schemas/Open' }, schemas: { Open: { type: 'object' } } });
        spec.paths['/y'] = { get: { operationId: 'getY', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Open' } } } } } } };
        assert.throws(() => load(spec), (err) => {
            assert.match(err.message, at('#/components/schemas/Open', 'object schema is not closed'));
            assert.equal(err.message.match(/components\/schemas\/Open:/g).length, 1);
            return true;
        });
    });

    test('a self-referencing schema is walked once', () => {
        const Node = closed({ children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } });
        loads(minimalSpec({ schema: { $ref: '#/components/schemas/Node' }, schemas: { Node } }));
    });

    test('application/*+json responses follow the same rules', () => {
        rejects(
            minimalSpec({ content: { 'application/problem+json': { schema: { type: 'object' } } } }),
            at('#/paths/~1x/get/responses/200/content/application~1problem+json/schema', 'object schema is not closed')
        );
    });

    test('non-JSON responses need no schema', () => {
        loads(minimalSpec({ content: { 'text/csv': {} } }));
    });
});

describe('composition: allOf fragments, oneOf variants, maps keyed by id', () => {
    const Timestamps = { type: 'object', required: ['created_at'], properties: { created_at: { type: 'string', format: 'date-time' } } };

    test('an allOf fragment may stay open when its parent sets unevaluatedProperties', () => {
        const Course = { type: 'object', allOf: [{ $ref: '#/components/schemas/Timestamps' }], properties: { id: { type: 'integer' } }, unevaluatedProperties: false };
        loads(minimalSpec({ schema: { $ref: '#/components/schemas/Course' }, schemas: { Timestamps, Course } }));
    });

    test('an allOf fragment of an open parent fails at the fragment and at the parent', () => {
        const Course = { type: 'object', allOf: [{ $ref: '#/components/schemas/Timestamps' }], properties: { id: { type: 'integer' } } };
        rejects(
            minimalSpec({ schema: { $ref: '#/components/schemas/Course' }, schemas: { Timestamps, Course } }),
            at('#/components/schemas/Course', 'object schema is not closed'),
            at('#/components/schemas/Timestamps', 'object schema is not closed')
        );
    });

    test('extending a closed schema fails: its own closing keyword rejects what the extension adds', () => {
        const Code = { type: 'object', allOf: [{ $ref: '#/components/schemas/Timestamps' }], properties: { id: { type: 'integer' } }, unevaluatedProperties: false };
        const CodeWithIntegration = { type: 'object', allOf: [{ $ref: '#/components/schemas/Code' }], properties: { integration: { type: 'string' } }, unevaluatedProperties: false };
        rejects(
            minimalSpec({ schema: { $ref: '#/components/schemas/CodeWithIntegration' }, schemas: { Timestamps, Code, CodeWithIntegration } }),
            at('#/components/schemas/CodeWithIntegration', 'allOf extends #/components/schemas/Code, which is closed and so rejects integration; extend an open fragment')
        );
        // Wrapping a closed schema without adding anything is fine.
        const Wrapped = { type: 'object', allOf: [{ $ref: '#/components/schemas/Code' }], unevaluatedProperties: false };
        loads(minimalSpec({ schema: { $ref: '#/components/schemas/Wrapped' }, schemas: { Timestamps, Code, Wrapped } }));
    });

    test('a property inside a fragment is checked on its own', () => {
        const Fragment = { type: 'object', properties: { meta: { type: 'object' } } };
        const Parent = { type: 'object', allOf: [{ $ref: '#/components/schemas/Fragment' }], unevaluatedProperties: false };
        rejects(
            minimalSpec({ schema: { $ref: '#/components/schemas/Parent' }, schemas: { Fragment, Parent } }),
            at('#/components/schemas/Fragment/properties/meta', 'object schema is not closed')
        );
    });

    test('oneOf variants are closed each on its own', () => {
        const User = closed({ id: { type: 'integer' }, email: { type: 'string' } });
        const UserLimited = closed({ id: { type: 'integer' } });
        loads(minimalSpec({ schema: { oneOf: [{ $ref: '#/components/schemas/User' }, { $ref: '#/components/schemas/UserLimited' }] }, schemas: { User, UserLimited } }));
        rejects(
            minimalSpec({ schema: { oneOf: [{ $ref: '#/components/schemas/User' }, { type: 'object', properties: { id: { type: 'integer' } } }] }, schemas: { User } }),
            at(`${SCHEMA}/oneOf/1`, 'object schema is not closed')
        );
    });

    test('a parent with unevaluatedProperties: false closes its oneOf variants and required-only fragments', () => {
        loads(minimalSpec({
            schema: {
                type: 'object',
                properties: { a: { type: 'string' }, b: { type: 'string' } },
                oneOf: [{ required: ['a'] }, { required: ['b'] }],
                unevaluatedProperties: false
            }
        }));
    });

    test('a map keyed by id (additionalProperties: <schema>) is closed, and its value schema is checked', () => {
        const Permissions = { type: 'object', properties: { global: { type: 'boolean' } }, additionalProperties: { type: 'array', items: { type: 'string' } } };
        loads(minimalSpec({ schema: { $ref: '#/components/schemas/Permissions' }, schemas: { Permissions } }));
        const OpenValues = { type: 'object', additionalProperties: { type: 'object' } };
        rejects(
            minimalSpec({ schema: { $ref: '#/components/schemas/OpenValues' }, schemas: { OpenValues } }),
            at('#/components/schemas/OpenValues/additionalProperties', 'object schema is not closed')
        );
    });

    test('the shared ErrorResponse (oneOf of two closed shapes, one with a map) passes', () => {
        const ErrorWithMessage = closed({ success: { const: false }, message: { type: 'string' } });
        const ErrorWithFields = closed({ success: { const: false }, errors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } } });
        loads(minimalSpec({
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            schemas: { ErrorResponse: { oneOf: [{ $ref: '#/components/schemas/ErrorWithMessage' }, { $ref: '#/components/schemas/ErrorWithFields' }] }, ErrorWithMessage, ErrorWithFields }
        }));
    });
});

describe('x-free-form: deliberately open JSON', () => {
    test('marks a schema as open on purpose, and the response check then accepts any value there', () => {
        const schema = closed({ answers: { type: 'object', 'x-free-form': 'answers to the questions each event defines' } });
        const contract = load(minimalSpec({ schema }));
        assert.doesNotThrow(() => contract.check({ path: '/x', statusCode: 200, headers: JSON_HEADERS, body: { answers: { anything: [1, { a: 2 }] } } }));
        assert.throws(() => contract.check({ path: '/x', statusCode: 200, headers: JSON_HEADERS, body: { answers: {}, other: 1 } }), /must NOT have additional properties 'other'/);
    });

    test('needs a reason', () => {
        rejects(minimalSpec({ schema: closed({ answers: { 'x-free-form': '' } }) }), at(`${SCHEMA}/properties/answers`, 'x-free-form needs a reason'));
        rejects(minimalSpec({ schema: closed({ answers: { 'x-free-form': true } }) }), at(`${SCHEMA}/properties/answers`, 'x-free-form needs a reason'));
    });
});

describe('the Todo placeholder', () => {
    const withTodo = () => minimalSpec({ schema: { $ref: '#/components/schemas/Todo' }, schemas: { Todo: { description: 'Placeholder, removed before review' } } });
    afterEach(() => {
        delete process.env.OPENAPI_ALLOW_TODO;
    });

    test('fails by default, naming each reference and the component', () => {
        rejects(withTodo(), at(SCHEMA, 'refers to the Todo placeholder'), /#\/components\/schemas\/Todo: the placeholder must be gone/);
    });

    test('a reference outside the responses (a request body) fails too', () => {
        const spec = minimalSpec({ schema: closed({}), schemas: { Todo: { description: 'Placeholder' } } });
        spec.paths['/x'].get.requestBody = { content: { 'application/json': { schema: { $ref: '#/components/schemas/Todo' } } } };
        rejects(spec, /Todo placeholder: #\/paths\/~1x\/get\/requestBody\/content\/application~1json\/schema: refers to the Todo placeholder/);
    });

    test('is accepted, and accepts any body, while OPENAPI_ALLOW_TODO=1', () => {
        process.env.OPENAPI_ALLOW_TODO = '1';
        const contract = load(withTodo());
        assert.doesNotThrow(() => contract.check({ path: '/x', statusCode: 200, headers: JSON_HEADERS, body: { whatever: true } }));
        delete process.env.OPENAPI_ALLOW_TODO;
        loads(withTodo(), { allowTodo: true });
    });
});

describe('statuses are listed one by one', () => {
    test('4XX ranges fail', () => {
        rejects(
            minimalSpec({ responses: { '4XX': { description: 'any client error' } } }),
            /GET \/x 4XX \(getX\): #\/paths\/~1x\/get\/responses\/4XX: '4XX' is not allowed: list each status the route returns/
        );
    });

    test('default fails', () => {
        rejects(minimalSpec({ responses: { default: { description: 'anything' } } }), /'default' is not allowed/);
    });
});

describe('x-untested: one exemption, one operation, one reason', () => {
    const errorSchemas = { Error: closed({ success: { const: false } }) };
    const errorResponse = (extra = {}) => ({ description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }, ...extra });

    test('an operation-level map with a reason for a documented status is accepted', () => {
        loads(minimalSpec({
            schemas: errorSchemas,
            responses: { 403: errorResponse() },
            operation: { 'x-untested': { 403: 'needs a broken core' } }
        }));
    });

    test('on a shared response component it fails, because every operation using it would be exempt', () => {
        const spec = minimalSpec({ schemas: errorSchemas, responses: { 403: { $ref: '#/components/responses/Forbidden' } } });
        spec.components.responses = { Forbidden: errorResponse({ 'x-untested': 'reason' }) };
        rejects(spec, /#\/components\/responses\/Forbidden: x-untested on a shared response would exempt every operation/);
    });

    test('on a response entry it fails, pointing at the operation-level form', () => {
        rejects(
            minimalSpec({ schemas: errorSchemas, responses: { 403: errorResponse({ 'x-untested': 'reason' }) } }),
            /GET \/x 403 \(getX\): x-untested on a response entry is not allowed; write x-untested: \{'<status>': '<reason>'\} on the operation/
        );
    });

    test('needs a reason, a documented status and the map form', () => {
        const spec = (untested) => minimalSpec({ schemas: errorSchemas, responses: { 403: errorResponse() }, operation: { 'x-untested': untested } });
        rejects(spec({ 403: ' ' }), /GET \/x 403 \(getX\): x-untested needs a reason/);
        rejects(spec({ 404: 'reason' }), /GET \/x \(getX\): x-untested names 404, which the operation does not document/);
        rejects(spec('reason'), /GET \/x \(getX\): x-untested maps statuses to reasons/);
    });
});

describe('spec-lint.js CLI', () => {
    const cli = path.join(__dirname, '..', 'spec-lint.js');

    test('lints the specs in redocly.yaml (the fixture)', () => {
        const run = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
        assert.equal(run.status, 0, run.stdout + run.stderr);
        assert.match(run.stdout, /fixtures\/openapi\.yaml: ok/);
    });

    test('fails on an open schema, and on Todo even with OPENAPI_ALLOW_TODO=1', () => {
        const open = path.join(writeSpec(minimalSpec({ schema: { type: 'object' } })), 'openapi.yaml');
        const todo = path.join(writeSpec(minimalSpec({ schema: { $ref: '#/components/schemas/Todo' }, schemas: { Todo: { description: 'x' } } })), 'openapi.yaml');
        const run = spawnSync(process.execPath, [cli, open, todo], { encoding: 'utf8', env: { ...process.env, OPENAPI_ALLOW_TODO: '1' } });
        assert.equal(run.status, 1);
        assert.match(run.stdout, /1 OpenAPI convention problem\(s\)[^\n]*\n {2}GET \/x 200 \(getX\): #\/paths\/~1x\/get\/responses\/200\/content\/application~1json\/schema: object schema is not closed/);
        assert.match(run.stdout, /refers to the Todo placeholder/);
    });
});
