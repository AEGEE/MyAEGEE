// Test-only OpenAPI contract checks for the MyAEGEE Express services.
//
// No npm dependencies of its own: ajv, ajv-formats and yaml are resolved from the
// calling service (createRequire), so this file works from the repository root in
// CircleCI, GitHub Actions and local runs, and can move into a package later as is.
// How to use it: docs/testing/backend-openapi.md.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// Keywords that are valid OpenAPI but unknown to Ajv's JSON Schema 2020-12 vocabulary.
const OPENAPI_ONLY_KEYWORDS = ['example', 'xml', 'externalDocs', 'discriminator'];
// The whole document is registered with Ajv so that internal $refs resolve; its
// top-level fields must be known keywords for strict mode.
const OPENAPI_DOCUMENT_FIELDS = ['openapi', 'info', 'jsonSchemaDialect', 'servers', 'paths',
    'webhooks', 'components', 'security', 'tags'];
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'trace'];

function stripExtensions(node) {
    if (Array.isArray(node)) return node.map(stripExtensions);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (!key.startsWith('x-')) out[key] = stripExtensions(value);
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

// requireFrom: a file whose node_modules provide ajv, ajv-formats and yaml. Defaults to
// the service's package.json; the helper's own unit tests point it at a service.
function createContract({ serviceRoot, specFile = 'openapi.yaml', requireFrom } = {}) {
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

    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
    addFormats(ajv);
    ajv.addVocabulary([...OPENAPI_ONLY_KEYWORDS, ...OPENAPI_DOCUMENT_FIELDS]);
    ajv.addSchema({ $id: 'openapi', ...stripExtensions(spec) });

    // Literal paths win over templated ones (/members/me before /members/{user_id}).
    const templates = Object.keys(spec.paths || {})
        .map((template) => ({
            template,
            regexp: templateToRegExp(template),
            params: (template.match(/\{/g) || []).length
        }))
        .sort((a, b) => a.params - b.params);

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
        const match = templates.find((t) => t.regexp.test(pathname));
        const lower = method.toLowerCase();
        if (!match || !spec.paths[match.template][lower]) {
            return { pathname, template: match && match.template };
        }
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
    function recordHit(template, method, status) {
        const file = process.env.OPENAPI_HITS_FILE;
        if (file) fs.appendFileSync(file, `${method.toUpperCase()} ${template} ${status}\n`);
    }

    // Called by test/scripts/helpers.js after every request. Throws on a violation.
    function check({ method = 'GET', path: urlPath, requestBody, statusCode, headers = {}, body }) {
        const upper = method.toUpperCase();
        const { pathname, template, operation } = findOperation(method, urlPath);
        if (!operation) {
            fail([`${upper} ${urlPath} -> ${statusCode}: no operation for ${upper} ${template || pathname} in the spec.`,
                'Document the route, or pass skipOpenApi: \'<reason>\' for a deliberately unknown route.']);
        }
        const label = `${upper} ${urlPath} -> ${statusCode} (${operation.operationId || template})`;
        const opPointer = `/paths/${escapePointer(template)}/${method.toLowerCase()}`;

        // A request the server accepted must match the documented request body.
        if (statusCode < 300 && requestBody !== undefined && operation.requestBody) {
            const { node: requestDoc, pointer } = deref(operation.requestBody, `${opPointer}/requestBody`);
            if (requestDoc.content && requestDoc.content['application/json']) {
                const validate = compile(`${pointer}/content/application~1json/schema`);
                if (!validate(requestBody)) {
                    fail([`${label}: the server accepted a request body that the spec rejects:`,
                        ...formatErrors(validate.errors), `request body: ${shorten(requestBody)}`]);
                }
            }
        }

        const responses = operation.responses || {};
        let key = String(statusCode);
        if (!responses[key]) key = `${key[0]}XX`;
        // Implicit responses, never listed per operation: 500 (unhandled error) everywhere,
        // and 400 (body is not valid JSON) on operations that take a JSON body. They are
        // not recorded as hits: there is nothing documented to exercise.
        if (!responses[key] && (statusCode === 500 || (statusCode === 400 && operation.requestBody))) {
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
        // Binary and text bodies: the media type is all that is checked.
        if (contentType !== 'application/json' || !content[contentType].schema) return;

        const { json, error } = parseJson(body);
        if (error) fail([`${label}: content-type is application/json, but the body is not JSON: ${shorten(body)}`]);
        const validate = compile(`${responsePointer}/content/application~1json/schema`);
        if (!validate(json)) {
            fail([`${label}: response body does not match ${responsePointer}:`,
                ...formatErrors(validate.errors), `body: ${shorten(json)}`]);
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
            ...result
        });
    };
}

module.exports = { createContract, createRequestHook, HTTP_METHODS };
