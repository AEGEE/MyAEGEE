#!/usr/bin/env node
// Usage: node packages/backend-test-utils/spec-lint.js [<openapi.yaml>...]
//
// The rules Redocly cannot express, for the services' OpenAPI files. createContract()
// runs them when it loads a spec, so a service's jest suite fails on them too; this CLI
// runs them in the openapi CI job on every spec listed in redocly.yaml (or on the files
// given), without any service wired up. Rules and reasons: docs/testing/backend-openapi.md.
//
// - Response schemas are closed: every object sets additionalProperties or
//   unevaluatedProperties (itself, or through the schema that applies it in place), every
//   array has items, every schema has a type, and a JSON response has a schema. Open JSON
//   is marked x-free-form: <reason>.
// - The Todo placeholder only while a spec is being built (OPENAPI_ALLOW_TODO=1 locally).
// - Statuses are listed one by one: no 4XX ranges, no default.
// - x-untested is an operation-level map, x-untested: {'403': <reason>}.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'trace'];
const TODO_REF = '#/components/schemas/Todo';
// Keywords that describe a schema without constraining it: a schema made of these only
// accepts any value.
const ANNOTATIONS = new Set(['title', 'description', '$comment', 'examples', 'example', 'default',
    'deprecated', 'readOnly', 'writeOnly', 'externalDocs', 'xml', 'discriminator', '$id', '$anchor', '$schema']);
// Applicators whose subschemas apply to the same value as their parent ("in place").
const IN_PLACE = ['allOf', 'oneOf', 'anyOf'];

function isJsonMediaType(mediaType) {
    return mediaType === 'application/json' || /^application\/[^/;]+\+json$/.test(mediaType);
}

function escapePointer(segment) {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function resolvePointer(spec, ref) {
    return ref.replace(/^#\//, '').split('/')
        .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce((acc, key) => (acc === undefined || acc === null ? undefined : acc[key]), spec);
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmptySchema(schema) {
    if (schema === true) return true;
    return isPlainObject(schema) && Object.keys(schema).every((k) => ANNOTATIONS.has(k) || k.startsWith('x-'));
}

function types(schema) {
    if (schema.type === undefined) return [];
    return Array.isArray(schema.type) ? schema.type : [schema.type];
}

// A schema that sets one of these is an object schema even without type: object.
const OBJECT_KEYWORDS = ['properties', 'patternProperties', 'additionalProperties', 'unevaluatedProperties'];

function closes(value) {
    return value === false || (isPlainObject(value) && !isEmptySchema(value));
}

function freeFormReason(schema) {
    if (!isPlainObject(schema) || schema['x-free-form'] === undefined) return undefined;
    return schema['x-free-form'];
}

// Every operation in the spec, with a label for messages.
function operations(spec) {
    const out = [];
    for (const [template, item] of Object.entries(spec.paths || {})) {
        if (isPlainObject(item)) {
            for (const method of HTTP_METHODS) {
                const op = item[method];
                if (isPlainObject(op)) {
                    out.push({
                        template,
                        method,
                        op,
                        pointer: `/paths/${escapePointer(template)}/${method}`,
                        // "GET /courses/{course_id}" plus a status, then "(getCourse)"
                        label: (status) => `${method.toUpperCase()} ${template}${status ? ` ${status}` : ''}`
                            + (op.operationId ? ` (${op.operationId})` : '')
                    });
                }
            }
        }
    }
    return out;
}

function followRef(spec, node, pointer) {
    let current = node;
    let currentPointer = pointer;
    const seen = new Set();
    while (isPlainObject(current) && typeof current.$ref === 'string' && current.$ref.startsWith('#')) {
        if (seen.has(current.$ref)) return { node: undefined, pointer: current.$ref.slice(1) };
        seen.add(current.$ref);
        currentPointer = current.$ref.slice(1);
        current = resolvePointer(spec, current.$ref);
    }
    return { node: current, pointer: currentPointer };
}

// The property names a schema declares, itself and through its allOf fragments.
function propertyNames(spec, schema, seen = new Set()) {
    const { node, pointer } = followRef(spec, schema, '');
    if (!isPlainObject(node) || seen.has(pointer || node)) return [];
    seen.add(pointer || node);
    return [
        ...Object.keys(node.properties || {}),
        ...(Array.isArray(node.allOf) ? node.allOf.flatMap((sub) => propertyNames(spec, sub, seen)) : [])
    ];
}

// A reason has to say why: not empty, not a placeholder, and more than a word.
const PLACEHOLDER_REASON = /^(todo|tbd|fixme|wip|xxx+|temp|later|reason|none|n\/?a|\?+|-+|\.+)\b/i;
function reasonProblem(reason) {
    if (typeof reason !== 'string' || reason.trim() === '') return 'needs a reason';
    const text = reason.trim();
    if (text.length < 10 || PLACEHOLDER_REASON.test(text)) return `needs a real reason, not '${text}': say why in a few words`;
    return undefined;
}

// x-untested is a map on the operation: x-untested: {'403': 'reason'}. Returns the
// exemptions ("GET /x 403" -> reason) and the misplaced or invalid uses.
function untestedExemptions(spec) {
    const exemptions = new Map();
    const problems = [];
    const MAP_FORM = "x-untested: {'<status>': '<reason>'} on the operation";
    for (const { template, method, op, pointer, label } of operations(spec)) {
        for (const [status, response] of Object.entries(op.responses || {})) {
            if (isPlainObject(response) && response['x-untested'] !== undefined) {
                problems.push(`${label(status)}: x-untested on a response entry is not allowed; write ${MAP_FORM}`);
            }
        }
        const map = op['x-untested'];
        if (map === undefined) continue;
        if (!isPlainObject(map)) {
            problems.push(`${label()}: x-untested maps statuses to reasons; write ${MAP_FORM}`);
            continue;
        }
        for (const [status, reason] of Object.entries(map)) {
            if (!(op.responses && Object.prototype.hasOwnProperty.call(op.responses, status))) {
                problems.push(`${label()}: x-untested names ${status}, which the operation does not document (${pointer})`);
            } else if (reasonProblem(reason)) {
                problems.push(`${label(status)}: x-untested ${reasonProblem(reason)}`);
            } else {
                exemptions.set(`${method.toUpperCase()} ${template} ${status}`, reason);
            }
        }
    }
    for (const [name, response] of Object.entries((spec.components && spec.components.responses) || {})) {
        if (isPlainObject(response) && response['x-untested'] !== undefined) {
            problems.push(`#/components/responses/${name}: x-untested on a shared response would exempt every operation `
                + `that uses it; write ${MAP_FORM} of each one instead`);
        }
    }
    return { exemptions, problems };
}

// Walks one response schema. mode 'fragment': the schema applies in place to a value that
// its parent already closes, so it needs neither a type nor its own closing keyword.
function createSchemaWalker(spec, { allowTodo, report }) {
    const visited = new Set();

    function walk(schema, pointer, where, mode) {
        if (schema === false) return;
        if (isPlainObject(schema) && schema.$ref === TODO_REF) {
            if (!allowTodo) report(where, pointer, 'refers to the Todo placeholder; write the real schema (Todo is accepted only by local test runs with OPENAPI_ALLOW_TODO=1)');
            return;
        }
        const reason = freeFormReason(schema);
        if (reason !== undefined) {
            if (reasonProblem(reason)) {
                report(where, pointer, `x-free-form ${reasonProblem(reason)}, for example x-free-form: 'answers to questions each event defines'`);
            }
            return;
        }
        if (isPlainObject(schema) && typeof schema.$ref === 'string') {
            const target = followRef(spec, schema, pointer);
            if (target.node === undefined) {
                report(where, pointer, `unresolved $ref '${schema.$ref}'`);
                return;
            }
            walk(target.node, target.pointer, where, mode);
            return;
        }
        const key = `${pointer}|${mode}`;
        if (visited.has(key)) return;
        visited.add(key);

        if (isEmptySchema(schema)) {
            report(where, pointer, 'empty schema accepts any value; describe the value, or mark it x-free-form: <reason>');
            return;
        }
        if (!isPlainObject(schema)) {
            report(where, pointer, 'is not a schema object');
            return;
        }

        const t = types(schema);
        const composed = IN_PLACE.some((k) => Array.isArray(schema[k]));
        const objectKeywords = OBJECT_KEYWORDS.filter((k) => schema[k] !== undefined);
        const isObject = t.includes('object') || objectKeywords.length > 0;
        const closed = closes(schema.additionalProperties) || closes(schema.unevaluatedProperties);

        if (objectKeywords.length > 0 && !t.includes('object')) {
            // Ajv's strict mode refuses these keywords without the type, but only when a test
            // first compiles the response; this says so when the spec loads.
            report(where, pointer, `uses ${objectKeywords.join(', ')} without type: object; add the type`);
        } else if (mode === 'normal' && t.length === 0 && !composed && schema.const === undefined && schema.enum === undefined) {
            report(where, pointer, 'schema has no type (nor allOf, oneOf, anyOf, const or enum); add one, or mark it x-free-form: <reason>');
        }
        if (isObject && !closed && mode === 'normal') {
            const open = schema.additionalProperties === true || schema.unevaluatedProperties === true
                || isEmptySchema(schema.additionalProperties) || isEmptySchema(schema.unevaluatedProperties);
            report(where, pointer, open
                ? 'object schema is explicitly open; close it, or mark it x-free-form: <reason>'
                : 'object schema is not closed; add additionalProperties: false (unevaluatedProperties: false when it uses allOf), '
                    + 'additionalProperties: <value schema> for a map keyed by id, or x-free-form: <reason>');
        }
        if (t.includes('array') && mode === 'normal' && schema.items === undefined && schema.prefixItems === undefined) {
            report(where, pointer, 'array schema has no items; describe the items');
        }

        // Extending a closed schema: its own additionalProperties or unevaluatedProperties
        // rejects whatever the extension adds, so every response fails.
        if (Array.isArray(schema.allOf)) {
            const added = (i) => [
                ...Object.keys(schema.properties || {}),
                ...schema.allOf.flatMap((sub, j) => (j === i ? [] : propertyNames(spec, sub)))
            ];
            schema.allOf.forEach((sub, i) => {
                const target = followRef(spec, sub, `${pointer}/allOf/${i}`);
                const n = target.node;
                if (isPlainObject(n) && (n.additionalProperties === false || n.unevaluatedProperties === false)) {
                    const own = new Set(propertyNames(spec, n));
                    const extra = [...new Set(added(i))].filter((name) => !own.has(name));
                    if (extra.length) {
                        report(where, pointer, `allOf extends #${target.pointer}, which is closed and so rejects `
                            + `${extra.join(', ')}; extend an open fragment instead and close only the leaf`);
                    }
                }
            });
        }

        // Subschemas of the same value: fragments when this schema (or its parent) closes it.
        const inPlaceMode = closed || mode === 'fragment' ? 'fragment' : 'normal';
        for (const k of IN_PLACE) {
            if (Array.isArray(schema[k])) schema[k].forEach((sub, i) => walk(sub, `${pointer}/${k}/${i}`, where, inPlaceMode));
        }
        for (const k of ['then', 'else']) {
            if (schema[k] !== undefined) walk(schema[k], `${pointer}/${k}`, where, inPlaceMode);
        }
        // Subschemas of other values (properties, items, map values): each is checked on its own.
        for (const k of ['properties', 'patternProperties', 'dependentSchemas']) {
            if (isPlainObject(schema[k])) {
                for (const [name, sub] of Object.entries(schema[k])) {
                    walk(sub, `${pointer}/${k}/${escapePointer(name)}`, where, k === 'dependentSchemas' ? inPlaceMode : 'normal');
                }
            }
        }
        for (const k of ['additionalProperties', 'unevaluatedProperties']) {
            if (isPlainObject(schema[k]) && !isEmptySchema(schema[k])) walk(schema[k], `${pointer}/${k}`, where, 'normal');
        }
        if (schema.items !== undefined && schema.items !== false) walk(schema.items, `${pointer}/items`, where, 'normal');
        if (Array.isArray(schema.prefixItems)) schema.prefixItems.forEach((sub, i) => walk(sub, `${pointer}/prefixItems/${i}`, where, 'normal'));
    }

    return walk;
}

// Returns a list of problems, one line each, naming the operation, status and JSON pointer.
function lintSpec(spec, { allowTodo = false } = {}) {
    const problems = [];
    const seen = new Set();
    const report = (where, pointer, message) => {
        const line = `${pointer}: ${message}`;
        if (!seen.has(line)) {
            seen.add(line);
            problems.push(`${where}: #${line}`);
        }
    };

    const walk = createSchemaWalker(spec, { allowTodo, report });
    for (const { op, pointer: opPointer, label } of operations(spec)) {
        for (const [status, response] of Object.entries(op.responses || {})) {
            const where = label(status);
            if (!/^[1-5]\d\d$/.test(status)) {
                report(
                    where,
                    `${opPointer}/responses/${escapePointer(status)}`,
                    /^[1-5]xx$/i.test(status) || status === 'default'
                        ? `'${status}' is not allowed: list each status the route returns`
                        : `'${status}' is not an HTTP status`
                );
                continue;
            }
            const { node: responseDoc, pointer } = followRef(spec, response, `${opPointer}/responses/${status}`);
            if (!isPlainObject(responseDoc)) {
                report(where, pointer, 'response does not resolve to a response object');
                continue;
            }
            for (const [mediaType, media] of Object.entries(responseDoc.content || {})) {
                const mediaPointer = `${pointer}/content/${escapePointer(mediaType)}`;
                if (isJsonMediaType(mediaType)) {
                    if (!isPlainObject(media) || media.schema === undefined) {
                        report(where, mediaPointer, 'a JSON response needs a schema (mark deliberately open JSON x-free-form: <reason>)');
                    } else {
                        walk(media.schema, `${mediaPointer}/schema`, where, 'normal');
                    }
                }
            }
        }
    }

    // Todo anywhere else (request bodies, the component itself).
    if (!allowTodo) {
        const todoProblems = [];
        const scan = (node, pointer) => {
            if (Array.isArray(node)) {
                node.forEach((item, i) => scan(item, `${pointer}/${i}`));
            } else if (isPlainObject(node)) {
                if (node.$ref === TODO_REF) todoProblems.push(pointer);
                for (const [k, v] of Object.entries(node)) scan(v, `${pointer}/${escapePointer(k)}`);
            }
        };
        scan(spec.paths, '/paths');
        for (const pointer of todoProblems) {
            report('Todo placeholder', pointer, 'refers to the Todo placeholder; write the real schema');
        }
        if (spec.components && spec.components.schemas && spec.components.schemas.Todo !== undefined) {
            report(
                'Todo placeholder',
                '/components/schemas/Todo',
                'the placeholder must be gone before the pull request is ready (it is accepted only by local test runs with OPENAPI_ALLOW_TODO=1)'
            );
        }
    }

    // The body of the implicit 500 and 400 responses, which the response check compiles.
    if (!(spec.components && spec.components.schemas && isPlainObject(spec.components.schemas.ErrorResponse))) {
        problems.push('#/components/schemas/ErrorResponse: every spec defines the ErrorResponse schema, '
            + 'the body of the implicit 500 and invalid-JSON 400 responses');
    }

    problems.push(...untestedExemptions(spec).problems);
    return problems;
}

// How many escape hatches a spec uses, printed by the CLI so that they show up in review.
function countMarkers(spec) {
    let freeForm = 0;
    const scan = (node) => {
        if (Array.isArray(node)) {
            node.forEach(scan);
        } else if (isPlainObject(node)) {
            if (node['x-free-form'] !== undefined) freeForm += 1;
            Object.values(node).forEach(scan);
        }
    };
    scan(spec);
    return { freeForm, untested: untestedExemptions(spec).exemptions.size };
}

function formatProblems(file, problems) {
    return `${file}: ${problems.length} OpenAPI convention problem(s) (docs/testing/backend-openapi.md):\n  `
        + problems.join('\n  ');
}

// The spec files listed in redocly.yaml apis, relative to the repository root.
function redoclySpecs(repoRoot, YAML) {
    const config = YAML.parse(fs.readFileSync(path.join(repoRoot, 'redocly.yaml'), 'utf8'));
    return Object.values((config && config.apis) || {}).map((api) => path.join(repoRoot, api.root));
}

if (require.main === module) {
    const repoRoot = path.join(__dirname, '..', '..');
    const YAML = createRequire(path.join(repoRoot, 'package.json'))('yaml');
    const files = process.argv.length > 2 ? process.argv.slice(2).map((f) => path.resolve(f)) : redoclySpecs(repoRoot, YAML);
    let failed = false;
    for (const file of files) {
        const spec = YAML.parse(fs.readFileSync(file, 'utf8'));
        const problems = lintSpec(spec);
        const shown = path.relative(process.cwd(), file);
        const { freeForm, untested } = countMarkers(spec);
        const markers = `x-free-form: ${freeForm}, x-untested: ${untested}`;
        if (problems.length) {
            failed = true;
            console.log(`${formatProblems(shown, problems)}\n  (${markers})`);
        } else {
            console.log(`${shown}: ok (${markers})`);
        }
    }
    process.exit(failed ? 1 : 0);
}

module.exports = { lintSpec, countMarkers, formatProblems, untestedExemptions, isJsonMediaType, operations, redoclySpecs, HTTP_METHODS, TODO_REF };
