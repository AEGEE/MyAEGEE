// Test-only OpenAPI contract checks for the MyAEGEE Express services.
//
// No npm dependencies of its own: ajv, ajv-formats and yaml are resolved from the
// calling service (createRequire), so this file works from the repository root in
// CircleCI, GitHub Actions and local runs, and can move into a package later as is.
// How to use it: docs/testing/backend-openapi.md.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const { lintSpec, formatProblems, isJsonMediaType } = require('./spec-lint');

// Keywords that are valid OpenAPI but unknown to Ajv's JSON Schema 2020-12 vocabulary.
const OPENAPI_ONLY_KEYWORDS = ['example', 'xml', 'externalDocs', 'discriminator'];
// The whole document is registered with Ajv so that internal $refs resolve; its
// top-level fields must be known keywords for strict mode.
const OPENAPI_DOCUMENT_FIELDS = ['openapi', 'info', 'jsonSchemaDialect', 'servers', 'paths',
    'webhooks', 'components', 'security', 'tags'];
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'trace'];

// Removes x-* extension keys before Ajv sees the document (strict mode rejects unknown
// keywords), but only where a key is a keyword: names in properties and other name maps,
// and literal values (const, enum, examples), keep keys that start with x-.
const NAME_MAPS = new Set(['properties', 'patternProperties', 'dependentSchemas', 'dependentRequired', '$defs', 'schemas']);
const LITERALS = new Set(['const', 'enum', 'default', 'example', 'examples']);

function stripExtensions(node) {
    if (Array.isArray(node)) return node.map(stripExtensions);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('x-')) continue;
        if (LITERALS.has(key)) {
            out[key] = value;
        } else if (NAME_MAPS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = Object.fromEntries(Object.entries(value).map(([name, sub]) => [name, stripExtensions(sub)]));
        } else {
            out[key] = stripExtensions(value);
        }
    }
    return out;
}

// Only refs inside the same file: the services' specs are self-contained.
function assertLocalRefs(node, specFile, where = '#') {
    if (Array.isArray(node)) {
        node.forEach((item, i) => assertLocalRefs(item, specFile, `${where}/${i}`));
        return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string' && !value.startsWith('#')) {
            throw new Error(`${specFile}: $ref '${value}' at ${where} points to another file; `
                + 'each service spec is self-contained (copy the component in)');
        }
        assertLocalRefs(value, specFile, `${where}/${key}`);
    }
}

function escapePointer(segment) {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function templateToRegExp(template) {
    const source = template
        .split('/')
        .map((segment) => (/^\{[^}]+\}$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/');
    return new RegExp('^' + source + '$');
}

// Literal segments before templated ones, from the left: /members/me before
// /members/{user_id}, /a/b/{c} before /a/{b}/c.
function compareTemplates(a, b) {
    const kinds = (t) => t.split('/').map((segment) => (/^\{[^}]+\}$/.test(segment) ? 1 : 0));
    const ka = kinds(a);
    const kb = kinds(b);
    for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
        if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return ka.length - kb.length;
}

function shorten(body) {
    if (Buffer.isBuffer(body)) return `<${body.length} bytes>`;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return text && text.length > 600 ? text.slice(0, 600) + '…' : text;
}

// A test that asked for responseType: 'buffer' (an export) gets a JSON error as bytes, and
// a body that failed to parse arrives as a string. Returns { json } or { error }.
function parseJson(body) {
    if (!Buffer.isBuffer(body) && typeof body !== 'string') return { json: body };
    try {
        return { json: JSON.parse(body.toString('utf8')) };
    } catch (err) { // eslint-disable-line no-unused-vars
        return { error: true };
    }
}

function isEmptyBody(body) {
    return body === '' || body === undefined || (Buffer.isBuffer(body) && body.length === 0);
}

// The hits file starts with a line naming the jest run that owns it, written by
// resetHitsFile() in the service's jest globalSetup. The check appends only to a file
// that this run started, so hits from an earlier local run cannot hide a missing test.
const HITS_HEADER = '# openapi hits, jest run ';

function resetHitsFile(file = process.env.OPENAPI_HITS_FILE) {
    if (file) fs.writeFileSync(file, `${HITS_HEADER}${process.pid}\n`);
}

function assertHitsFileOwned(file) {
    let first = '';
    try {
        first = fs.readFileSync(file, 'utf8').split('\n', 1)[0];
    } catch (err) { // eslint-disable-line no-unused-vars
        // missing: reported below
    }
    const owner = first.startsWith(HITS_HEADER) ? Number(first.slice(HITS_HEADER.length)) : undefined;
    if (owner !== process.pid && owner !== process.ppid) {
        throw new Error(`OPENAPI_HITS_FILE ${file} was not started by this jest run. Add the shared globalSetup `
            + '(packages/backend-test-utils/jest-global-setup.js) to the service\'s jest config, or call resetHitsFile() '
            + 'from its own globalSetup (docs/testing/backend-openapi.md).');
    }
}

// requireFrom: a file whose node_modules provide ajv, ajv-formats and yaml. Defaults to
// the service's package.json; the helper's own unit tests point it at a service.
// allowTodo: accept the Todo placeholder schema (a spec being built). Defaults to
// OPENAPI_ALLOW_TODO=1 in the environment; CI never sets it.
function createContract({ serviceRoot, specFile = 'openapi.yaml', requireFrom, allowTodo = process.env.OPENAPI_ALLOW_TODO === '1' } = {}) {
    if (!serviceRoot) throw new Error('createContract needs serviceRoot');
    const requireFromService = createRequire(requireFrom || path.join(serviceRoot, 'package.json'));
    const YAML = requireFromService('yaml');
    const Ajv2020 = requireFromService('ajv/dist/2020');
    const addFormats = requireFromService('ajv-formats');

    const specPath = path.join(serviceRoot, specFile);
    if (!fs.existsSync(specPath)) {
        throw new Error(`${specPath} does not exist. Every service that checks responses has an openapi.yaml `
            + 'at its root (docs/testing/backend-openapi.md).');
    }
    const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));
    if (!spec || !/^3\.1\.\d+$/.test(String(spec.openapi))) {
        throw new Error(`${specFile}: expected OpenAPI 3.1.x, got ${spec && spec.openapi}`);
    }
    assertLocalRefs(spec, specFile);
    const problems = lintSpec(spec, { allowTodo });
    if (problems.length) throw new Error(formatProblems(specFile, problems));

    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
    addFormats(ajv);
    ajv.addVocabulary([...OPENAPI_ONLY_KEYWORDS, ...OPENAPI_DOCUMENT_FIELDS]);
    ajv.addSchema({ $id: 'openapi', ...stripExtensions(spec) });

    // Literal paths win over templated ones (/members/me before /members/{user_id}).
    const templates = Object.keys(spec.paths || {})
        .sort(compareTemplates)
        .map((template) => ({ template, regexp: templateToRegExp(template) }));

    const validators = new Map();
    const compile = (pointer) => {
        if (!validators.has(pointer)) {
            validators.set(pointer, ajv.compile({ $ref: 'openapi#' + pointer }));
        }
        return validators.get(pointer);
    };

    const resolvePointer = (ref) => ref
        .replace(/^#\//, '')
        .split('/')
        .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce((acc, key) => (acc === undefined ? undefined : acc[key]), spec);

    // Follows a chain of $refs; returns the final object and its JSON pointer.
    const deref = (node, pointer) => {
        let current = node;
        let currentPointer = pointer;
        while (current && current.$ref) {
            currentPointer = current.$ref.replace(/^#/, '');
            const next = resolvePointer(current.$ref);
            if (next === undefined) throw new Error(`${specFile}: unresolved $ref '${current.$ref}'`);
            current = next;
        }
        return { node: current, pointer: currentPointer };
    };

    function findOperation(method, urlPath) {
        const pathname = new URL(urlPath, 'http://x').pathname.replace(/(.)\/$/, '$1');
        const lower = method.toLowerCase();
        // Path and method together, as Express routes: PUT /members/me goes to
        // /members/{user_id} when only GET /members/me is literal.
        const matches = templates.filter((t) => t.regexp.test(pathname));
        const match = matches.find((t) => spec.paths[t.template][lower]);
        if (!match) return { pathname, template: matches.length ? matches[0].template : undefined };
        return { pathname, template: match.template, operation: spec.paths[match.template][lower] };
    }

    function fail(lines) {
        const error = new Error(['OpenAPI contract violation:', ...lines].join('\n  '));
        Error.captureStackTrace(error, fail);
        throw error;
    }

    function formatErrors(errors) {
        return errors.slice(0, 10).map((e) => `${e.instancePath || '(root)'} ${e.message}`
            + (e.params && e.params.additionalProperty ? ` '${e.params.additionalProperty}'` : '')
            + (e.params && e.params.unevaluatedProperty ? ` '${e.params.unevaluatedProperty}'` : ''));
    }

    // One line per checked response, read by unexercised.js after all shards finish.
    let hitsFileChecked;
    function recordHit(template, method, status) {
        const file = process.env.OPENAPI_HITS_FILE;
        if (!file) return;
        if (hitsFileChecked !== file) {
            assertHitsFileOwned(file);
            hitsFileChecked = file;
        }
        fs.appendFileSync(file, `${method.toUpperCase()} ${template} ${status}\n`);
    }

    // A request body sent as text that does not parse as JSON (the invalid-JSON tests).
    function isInvalidJsonText(sent) {
        if (typeof sent !== 'string') return false;
        try {
            JSON.parse(sent);
            return false;
        } catch (err) {
            return true;
        }
    }

    // Called by test/scripts/helpers.js after every request. Throws on a violation.
    // `variant`, for a response that depends on the caller: the name of a schema in
    // components/schemas that the response's `data` must also match (the documented schema
    // is a oneOf of the callers' variants, so on its own it cannot tell which caller got which).
    function check({ method = 'GET', path: urlPath, requestBody, statusCode, headers = {}, body, variant }) {
        const upper = method.toUpperCase();
        const { pathname, template, operation } = findOperation(method, urlPath);
        if (!operation) {
            fail([`${upper} ${urlPath} -> ${statusCode}: no operation for ${upper} ${template || pathname} in the spec.`,
                'Document the route, or pass skipOpenApi: \'<reason>\' for a deliberately unknown route.']);
        }
        const label = `${upper} ${urlPath} -> ${statusCode} (${operation.operationId || template})`;
        const opPointer = `/paths/${escapePointer(template)}/${method.toLowerCase()}`;

        // A request the server accepted must match the documented request body.
        if (statusCode < 300 && requestBody !== undefined) {
            if (!operation.requestBody) {
                fail([`${label}: the server accepted a request with a JSON body, but the operation documents no requestBody.`,
                    'Document the body, or stop sending it.', `request body: ${shorten(requestBody)}`]);
            }
            const { node: requestDoc, pointer } = deref(operation.requestBody, `${opPointer}/requestBody`);
            const jsonType = Object.keys(requestDoc.content || {}).find(isJsonMediaType);
            if (!jsonType) {
                fail([`${label}: the server accepted a JSON request body, but the operation documents only `
                    + `${Object.keys(requestDoc.content || {}).join(', ') || 'no media type'}.`]);
            }
            if (requestDoc.content[jsonType].schema) {
                const validate = compile(`${pointer}/content/${escapePointer(jsonType)}/schema`);
                if (!validate(requestBody)) {
                    fail([`${label}: the server accepted a request body that the spec rejects:`,
                        ...formatErrors(validate.errors), `request body: ${shorten(requestBody)}`]);
                }
            }
        }

        const responses = operation.responses || {};
        // Statuses are listed one by one: the spec lint refuses 4XX ranges and default.
        const key = String(statusCode);
        // Implicit responses, never listed per operation: 500 (unhandled error) everywhere,
        // and 400 on operations that take a JSON body, but only when the test really sent
        // a body that is not valid JSON. Every other 400 is the route's own and is listed.
        // Implicit responses are not recorded as hits: there is nothing documented to exercise.
        const implicit400 = statusCode === 400 && operation.requestBody && isInvalidJsonText(requestBody);
        if (!responses[key] && (statusCode === 500 || implicit400)) {
            const validate = compile('/components/schemas/ErrorResponse');
            const { json, error } = parseJson(body);
            if (error || !validate(json)) {
                fail([`${label}: body is not an ErrorResponse:`, ...(error ? ['not JSON'] : formatErrors(validate.errors)), `body: ${shorten(body)}`]);
            }
            return;
        }
        if (!responses[key]) {
            fail([`${label}: status ${statusCode} is not documented for ${upper} ${template}`
                + ` (documented: ${Object.keys(responses).join(', ') || 'none'}).`, `body: ${shorten(body)}`]);
        }
        recordHit(template, method, statusCode);

        const { node: responseDoc, pointer: responsePointer } = deref(responses[key], `${opPointer}/responses/${key}`);
        const content = responseDoc.content || {};
        const mediaTypes = Object.keys(content);
        if (mediaTypes.length === 0) {
            if (!isEmptyBody(body)) {
                fail([`${label}: the spec documents no body, but the response has one: ${shorten(body)}`]);
            }
            return;
        }
        const contentType = String(headers['content-type'] || '').split(';')[0].trim();
        if (!mediaTypes.includes(contentType)) {
            fail([`${label}: content-type '${contentType}' is not documented (documented: ${mediaTypes.join(', ')}).`]);
        }
        // Binary and text bodies: the media type is all that is checked. JSON bodies
        // (application/json and application/*+json) are validated; the spec lint makes sure
        // that every JSON response has a schema.
        if (!isJsonMediaType(contentType) || !content[contentType].schema) return;

        const { json, error } = parseJson(body);
        if (error) fail([`${label}: content-type is ${contentType}, but the body is not JSON: ${shorten(body)}`]);
        const validate = compile(`${responsePointer}/content/${escapePointer(contentType)}/schema`);
        if (!validate(json)) {
            fail([`${label}: response body does not match ${responsePointer}:`,
                ...formatErrors(validate.errors), `body: ${shorten(json)}`]);
        }
        if (variant !== undefined) {
            const variantPointer = `/components/schemas/${escapePointer(variant)}`;
            if (resolvePointer('#' + variantPointer) === undefined) {
                fail([`${label}: the test expects the variant ${variant}, which is not in components/schemas.`]);
            }
            const validateVariant = compile(variantPointer);
            if (!json || typeof json !== 'object' || !validateVariant(json.data)) {
                fail([`${label}: data does not match the variant ${variant} the test expects:`,
                    ...(validateVariant.errors ? formatErrors(validateVariant.errors) : ['no data']), `body: ${shorten(json)}`]);
            }
        }
    }

    return { spec, check, findOperation };
}

// The hook for a service's test/scripts/helpers.js request(). The contract is created on
// the first call, because jest loads helpers.js again for every test file.
//
//   const checkResponse = createRequestHook({ serviceRoot: path.join(__dirname, '..', '..') });
//   ... at the end of request(), and before the responseType: 'buffer' early return:
//   checkResponse(options, fetchOptions, result);
//
// options.skipOpenApi: '<reason>' skips the check, for requests to routes that deliberately
// do not exist (the not-found handler tests). A skip without a reason throws.
// options.openApiVariant: '<schema name>' also checks the response's `data` against that
// schema, for responses that depend on the caller (see check()).
function createRequestHook(contractOptions) {
    let contract;
    return function checkResponse(options, fetchOptions, result) {
        if (options.skipOpenApi !== undefined) {
            if (typeof options.skipOpenApi !== 'string' || options.skipOpenApi.trim().length === 0) {
                throw new Error('skipOpenApi needs a reason, for example skipOpenApi: \'the not-found handler\'');
            }
            return;
        }
        contract = contract || createContract(contractOptions);
        contract.check({
            method: fetchOptions.method,
            path: options.path,
            // Multipart requests (options.files) are not validated.
            requestBody: options.files ? undefined : options.body,
            variant: options.openApiVariant,
            ...result
        });
    };
}

module.exports = { createContract, createRequestHook, resetHitsFile, HTTP_METHODS };
