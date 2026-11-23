const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createContract, createRequestHook } = require('../openapi');
const { FIXTURES, REQUIRE_FROM, tmpDir } = require('./helpers');

const contract = createContract({ serviceRoot: FIXTURES, requireFrom: REQUIRE_FROM });
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const course = (overrides = {}) => ({
    id: 1,
    name: 'Course',
    description: null,
    fee: '12.50',
    created_at: '2026-11-23T10:00:00.000Z',
    updated_at: '2026-11-23T10:00:00.000Z',
    ...overrides
});

const ok = (args) => assert.doesNotThrow(() => contract.check({ headers: JSON_HEADERS, ...args }));
const violation = (args, pattern) => assert.throws(
    () => contract.check({ headers: JSON_HEADERS, ...args }),
    (err) => {
        assert.match(err.message, /^OpenAPI contract violation:/);
        assert.match(err.message, pattern);
        return true;
    }
);

describe('createContract', () => {
    test('rejects a spec that is not OpenAPI 3.1', () => {
        const dir = tmpDir('version');
        fs.writeFileSync(path.join(dir, 'openapi.yaml'), 'openapi: 3.0.3\ninfo: { title: x, version: "1" }\npaths: {}\n');
        assert.throws(() => createContract({ serviceRoot: dir, requireFrom: REQUIRE_FROM }), /expected OpenAPI 3\.1\.x, got 3\.0\.3/);
    });

    test('rejects a $ref to another file', () => {
        const dir = tmpDir('ref');
        fs.writeFileSync(path.join(dir, 'openapi.yaml'), [
            'openapi: 3.1.1',
            'info: { title: x, version: "1" }',
            'paths:',
            '  /x:',
            '    get:',
            '      responses:',
            "        '200': { $ref: './shared.yaml#/components/responses/Ok' }"
        ].join('\n'));
        assert.throws(() => createContract({ serviceRoot: dir, requireFrom: REQUIRE_FROM }), /points to another file/);
    });

    test('names the missing file when a service has no spec', () => {
        assert.throws(() => createContract({ serviceRoot: tmpDir('missing'), requireFrom: REQUIRE_FROM }), /openapi\.yaml does not exist/);
    });

    test('strips x-* keys, so x-permission and x-untested do not break Ajv strict mode', () => {
        // The fixture has x-permission on every operation and x-untested on one response.
        ok({ method: 'POST', path: '/courses', requestBody: { name: 'A' }, statusCode: 201, body: { success: true, data: course() } });
    });
});

describe('path and operation matching', () => {
    test('a literal path wins over a templated one', () => {
        // 401 is documented for getMe only, so this passes only if /members/me matched getMe.
        ok({ path: '/members/me', statusCode: 401, body: { success: false, message: 'No token' } });
        violation(
            { path: '/members/12', statusCode: 401, body: { success: false, message: 'No token' } },
            /status 401 is not documented for GET \/members\/\{user_id\}/
        );
    });

    test('strips the query string and a trailing slash', () => {
        ok({ path: '/courses/?limit=1&offset=0', statusCode: 200, body: { success: true, data: [course()], meta: { count: 1 } } });
        ok({ path: 'courses/1/', statusCode: 200, body: { success: true, data: course() } });
    });

    test('fails on an undocumented path', () => {
        violation(
            { path: '/nonexistent', statusCode: 404, body: { success: false, message: 'Not found' } },
            /no operation for GET \/nonexistent in the spec/
        );
    });

    test('fails on an undocumented method of a documented path', () => {
        violation(
            { method: 'PUT', path: '/courses/1', statusCode: 200, body: { success: true, data: course() } },
            /no operation for PUT \/courses\/\{course_id\}/
        );
    });

    test('fails on an undocumented status, and lists the documented ones', () => {
        violation(
            { path: '/courses/1', statusCode: 403, body: { success: false, message: 'No' } },
            /GET \/courses\/1 -> 403 \(getCourse\): status 403 is not documented for GET \/courses\/\{course_id\} \(documented: 200, 400, 404\)/
        );
    });

    test('falls back to a 4XX range response', () => {
        ok({ path: '/courses', statusCode: 418, body: { success: false, message: 'Teapot' } });
        violation({ path: '/courses', statusCode: 418, body: { message: 'Teapot' } }, /must have required property 'success'/);
    });
});

describe('implicit responses', () => {
    test('500 is accepted on any operation when the body is an ErrorResponse', () => {
        ok({ path: '/courses/1', statusCode: 500, body: { success: false, message: 'Internal error' } });
        violation({ path: '/courses/1', statusCode: 500, body: 'Internal error' }, /body is not an ErrorResponse/);
    });

    test('400 is accepted on an operation with a request body (invalid JSON)', () => {
        ok({ method: 'POST', path: '/courses', statusCode: 400, body: { success: false, message: 'Unexpected token' } });
    });

    test('400 is not implicit on an operation without a request body', () => {
        violation(
            { path: '/members/12', statusCode: 400, body: { success: false, message: 'Bad' } },
            /status 400 is not documented for GET \/members\/\{user_id\}/
        );
    });
});

describe('response bodies', () => {
    test('a closed schema fails on an undocumented field', () => {
        violation(
            { path: '/members/12', statusCode: 200, body: { success: true, data: { id: 12, first_name: 'A', password: 'x' } } },
            /\/data must NOT have additional properties 'password'/
        );
    });

    test('an allOf schema closed with unevaluatedProperties fails on an undocumented field', () => {
        violation(
            { path: '/courses/1', statusCode: 200, body: { success: true, data: course({ secret: 1 }) } },
            /\/data must NOT have unevaluated properties 'secret'/
        );
    });

    test('fields from the allOf fragment are evaluated, and required', () => {
        const { created_at: _, ...withoutCreatedAt } = course();
        violation(
            { path: '/courses/1', statusCode: 200, body: { success: true, data: withoutCreatedAt } },
            /\/data must have required property 'created_at'/
        );
    });

    test("type: [string, 'null'] accepts both and nothing else", () => {
        ok({ path: '/courses/1', statusCode: 200, body: { success: true, data: course({ description: 'text' }) } });
        ok({ path: '/courses/1', statusCode: 200, body: { success: true, data: course({ description: null }) } });
        violation(
            { path: '/courses/1', statusCode: 200, body: { success: true, data: course({ description: 3 }) } },
            /\/data\/description must be string,null/
        );
    });

    test('Decimal accepts a numeric string and a number, not other strings', () => {
        ok({ path: '/courses/1', statusCode: 200, body: { success: true, data: course({ fee: '10' }) } });
        ok({ path: '/courses/1', statusCode: 200, body: { success: true, data: course({ fee: 10.5 }) } });
        violation(
            { path: '/courses/1', statusCode: 200, body: { success: true, data: course({ fee: 'ten' }) } },
            /\/data\/fee must match pattern/
        );
    });

    test('date-time format is checked', () => {
        violation(
            { path: '/courses/1', statusCode: 200, body: { success: true, data: course({ created_at: 'yesterday' }) } },
            /\/data\/created_at must match format "date-time"/
        );
    });

    test('$ref responses are followed (shared NotFound)', () => {
        ok({ path: '/courses/1', statusCode: 404, body: { success: false, message: 'Course is not found.' } });
        ok({ path: '/courses/1', statusCode: 404, body: { success: false, errors: { id: ['not found'] } } });
        violation({ path: '/courses/1', statusCode: 404, body: { success: false } }, /must match exactly one schema in oneOf/);
    });

    test('a response without content must have an empty body', () => {
        ok({ method: 'DELETE', path: '/courses/1', statusCode: 204, headers: {}, body: '' });
        ok({ method: 'DELETE', path: '/courses/1', statusCode: 204, headers: {}, body: Buffer.alloc(0) });
        violation(
            { method: 'DELETE', path: '/courses/1', statusCode: 204, body: { success: true } },
            /the spec documents no body, but the response has one/
        );
    });

    test('a content-type that is not documented fails', () => {
        violation(
            { path: '/courses/1', statusCode: 200, headers: { 'content-type': 'text/html' }, body: '<p>' },
            /content-type 'text\/html' is not documented \(documented: application\/json\)/
        );
    });

    test('non-JSON media types are compared without parameters, and the body is not parsed', () => {
        ok({ path: '/metrics', statusCode: 200, headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' }, body: '# HELP x' });
        ok({
            path: '/courses/1/export',
            statusCode: 200,
            headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            body: Buffer.from('PK')
        });
    });
});

describe('bodies read as a buffer or as text', () => {
    test('a JSON body that arrived as a Buffer (responseType: buffer) is parsed and validated', () => {
        ok({ path: '/courses/1', statusCode: 404, body: Buffer.from('{"success":false,"message":"Course is not found."}') });
        ok({ path: '/courses/1', statusCode: 500, body: Buffer.from('{"success":false,"message":"boom"}') });
        violation({ path: '/courses/1', statusCode: 404, body: Buffer.from('{"success":true}') }, /must match exactly one schema in oneOf/);
    });

    test('a body labelled application/json that is not JSON fails', () => {
        violation({ path: '/courses/1', statusCode: 404, body: 'Not found' }, /content-type is application\/json, but the body is not JSON/);
        violation({ path: '/courses/1', statusCode: 500, body: Buffer.from('<html>') }, /body is not an ErrorResponse:\n {2}not JSON/);
    });
});

describe('request bodies', () => {
    test('a body the server accepted (2xx) must match the $ref request body', () => {
        violation(
            { method: 'POST', path: '/courses', requestBody: { name: '' }, statusCode: 201, body: { success: true, data: course() } },
            /the server accepted a request body that the spec rejects:\n {2}\/name must NOT have fewer than 1 characters/
        );
    });

    test('request body schemas stay open: extra fields are accepted', () => {
        ok({ method: 'POST', path: '/courses', requestBody: { name: 'A', extra: true }, statusCode: 201, body: { success: true, data: course() } });
    });

    test('a request body is not checked when the server rejected it', () => {
        ok({ method: 'POST', path: '/courses', requestBody: { name: '' }, statusCode: 422, body: { success: false, errors: { name: ['empty'] } } });
    });
});

describe('hits file', () => {
    let file;
    beforeEach(() => {
        file = path.join(tmpDir('hits'), 'hits.txt');
        process.env.OPENAPI_HITS_FILE = file;
    });
    afterEach(() => {
        delete process.env.OPENAPI_HITS_FILE;
    });

    test('records METHOD template status for documented responses, not for implicit ones', () => {
        ok({ path: '/courses/7', statusCode: 200, body: { success: true, data: course() } });
        ok({ path: '/courses/7', statusCode: 500, body: { success: false, message: 'boom' } });
        ok({ path: '/courses', statusCode: 418, body: { success: false, message: 'Teapot' } });
        assert.equal(fs.readFileSync(file, 'utf8'), 'GET /courses/{course_id} 200\nGET /courses 418\n');
    });
});

describe('createRequestHook', () => {
    const hook = createRequestHook({ serviceRoot: FIXTURES, requireFrom: REQUIRE_FROM });
    const result = { statusCode: 200, headers: JSON_HEADERS, body: { success: true, data: course() } };

    test('checks the response of a request', () => {
        assert.doesNotThrow(() => hook({ path: '/courses/1' }, { method: 'GET' }, result));
        assert.throws(() => hook({ path: '/courses/1' }, { method: 'GET' }, { ...result, statusCode: 403 }), /status 403 is not documented/);
    });

    test('skipOpenApi with a reason skips the check', () => {
        assert.doesNotThrow(() => hook({ path: '/nonexistent', skipOpenApi: 'the not-found handler' }, { method: 'GET' }, result));
    });

    test('skipOpenApi without a reason throws', () => {
        assert.throws(() => hook({ path: '/nonexistent', skipOpenApi: true }, { method: 'GET' }, result), /skipOpenApi needs a reason/);
        assert.throws(() => hook({ path: '/nonexistent', skipOpenApi: ' ' }, { method: 'GET' }, result), /skipOpenApi needs a reason/);
    });

    test('multipart requests are not validated against the request body', () => {
        const created = { statusCode: 201, headers: JSON_HEADERS, body: { success: true, data: course() } };
        assert.doesNotThrow(() => hook({ path: '/courses', files: { file: [] }, body: { name: '' } }, { method: 'POST' }, created));
    });
});
