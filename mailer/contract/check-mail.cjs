// Checks a mail request (the body the services POST to the mailer) against the mail
// contract in mail-templates.json. No dependencies: the services' jest suites, the e2e
// fake mailer and `node --test` load it as it is.
//
// The schemas use a small subset of JSON Schema: type (a name or a list of names),
// properties, required, additionalProperties (only `false` has an effect), items, enum,
// minLength, minItems and $ref to "#/$defs/<name>". Anything else is an error in the
// manifest, so that a keyword nobody checks can't give a false sense of safety.

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_PATH = path.join(__dirname, 'mail-templates.json');

const KNOWN_KEYWORDS = new Set([
    'type', 'properties', 'required', 'additionalProperties', 'items', 'enum',
    'minLength', 'minItems', '$ref', 'description'
]);

let cachedManifest;

function loadManifest() {
    if (!cachedManifest) {
        cachedManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    }
    return cachedManifest;
}

// "confirm_email.html" and "confirm_email" name the same template, as in the mailer.
function templateName(name) {
    return typeof name === 'string' ? name.replace(/\.html$/, '') : name;
}

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
}

function typeMatches(value, type) {
    const actual = typeOf(value);
    return actual === type || (type === 'number' && actual === 'integer');
}

function resolve(schema, manifest) {
    let current = schema;
    const seen = new Set();
    while (current && current.$ref) {
        const match = /^#\/\$defs\/([\w-]+)$/.exec(current.$ref);
        if (!match || !manifest.$defs || !manifest.$defs[match[1]]) {
            throw new Error(`Unresolvable $ref ${JSON.stringify(current.$ref)}`);
        }
        if (seen.has(current.$ref)) throw new Error(`Circular $ref ${current.$ref}`);
        seen.add(current.$ref);
        current = manifest.$defs[match[1]];
    }
    return current;
}

function join(parent, key) {
    if (parent === '') return String(key);
    return typeof key === 'number' ? `${parent}[${key}]` : `${parent}.${key}`;
}

// Pushes one "<path>: <problem>" string per problem into `errors`.
function validate(value, schemaOrRef, at, manifest, errors) {
    const schema = resolve(schemaOrRef, manifest);
    if (!schema || typeof schema !== 'object') return;

    for (const keyword of Object.keys(schema)) {
        if (!KNOWN_KEYWORDS.has(keyword)) throw new Error(`Unsupported schema keyword "${keyword}" at ${at || '(root)'}`);
    }

    const label = at || '(root)';

    if (schema.type !== undefined) {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];
        if (!types.some((type) => typeMatches(value, type))) {
            errors.push(`${label}: expected ${types.join(' or ')}, got ${value === undefined ? 'nothing' : typeOf(value)}`);
            return;
        }
    }

    if (schema.enum && !schema.enum.some((allowed) => allowed === value)) {
        errors.push(`${label}: expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}, got ${JSON.stringify(value)}`);
    }

    if (typeof value === 'string' && typeof schema.minLength === 'number' && value.length < schema.minLength) {
        errors.push(`${label}: expected at least ${schema.minLength} character(s)`);
    }

    if (Array.isArray(value)) {
        if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
            errors.push(`${label}: expected at least ${schema.minItems} item(s)`);
        }
        if (schema.items) {
            value.forEach((item, index) => validate(item, schema.items, join(at, index), manifest, errors));
        }
    }

    if (typeOf(value) === 'object') {
        for (const key of schema.required || []) {
            if (value[key] === undefined) errors.push(`${join(at, key)}: missing`);
        }
        const properties = schema.properties || {};
        for (const [key, child] of Object.entries(value)) {
            if (properties[key]) {
                if (child !== undefined) validate(child, properties[key], join(at, key), manifest, errors);
            } else if (schema.additionalProperties === false) {
                errors.push(`${join(at, key)}: not allowed`);
            }
        }
    }
}

// The envelope as it goes over the wire: models become plain objects, dates strings,
// undefined values disappear.
function asSent(envelope) {
    return envelope === undefined ? undefined : JSON.parse(JSON.stringify(envelope));
}

/**
 * Checks one mail request.
 * @returns {{ ok: boolean, template: string|undefined, unknownTemplate: boolean, errors: string[] }}
 */
function checkMail(envelope, manifest = loadManifest()) {
    const sent = asSent(envelope);
    const errors = [];
    validate(sent, manifest.envelope, '', manifest, errors);

    const template = templateName(sent && sent.template);
    const entry = typeof template === 'string' ? manifest.templates[template] : undefined;
    if (typeof template === 'string' && !entry) {
        return { ok: false, template, unknownTemplate: true, errors: [`unknown template "${template}"`, ...errors] };
    }

    if (entry && sent && sent.parameters !== undefined && sent.parameters !== null) {
        if (Array.isArray(sent.parameters)) {
            if (!entry.per_recipient_parameters) {
                errors.push(`parameters: template "${template}" takes one parameter object, not a list`);
            } else {
                const recipients = Array.isArray(sent.to) ? sent.to.length : 1;
                if (!Array.isArray(sent.to) || sent.parameters.length !== recipients) {
                    errors.push(`parameters: ${sent.parameters.length} parameter object(s) for ${recipients} recipient(s); a list needs one per address in "to"`);
                }
                sent.parameters.forEach((item, index) => validate(item, entry.parameters, `parameters[${index}]`, manifest, errors));
            }
        } else {
            validate(sent.parameters, entry.parameters, 'parameters', manifest, errors);
        }
    }

    return { ok: errors.length === 0, template, unknownTemplate: false, errors };
}

// Every dotted path a schema declares; list items are "<path>.[]".
function declaredPaths(schemaOrRef, manifest = loadManifest(), prefix = '', out = new Set()) {
    const schema = resolve(schemaOrRef, manifest);
    if (!schema) return out;
    for (const [key, child] of Object.entries(schema.properties || {})) {
        const at = prefix ? `${prefix}.${key}` : key;
        out.add(at);
        declaredPaths(child, manifest, at, out);
    }
    if (schema.items) {
        const at = prefix ? `${prefix}.[]` : '[]';
        out.add(at);
        declaredPaths(schema.items, manifest, at, out);
    }
    return out;
}

// Required dotted paths: a path counts when it and every object above it are required.
function requiredPaths(schemaOrRef, manifest = loadManifest(), prefix = '', out = new Set()) {
    const schema = resolve(schemaOrRef, manifest);
    if (!schema) return out;
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
        const at = prefix ? `${prefix}.${key}` : key;
        out.add(at);
        if (properties[key]) requiredPaths(properties[key], manifest, at, out);
    }
    if (schema.items) {
        const at = prefix ? `${prefix}.[]` : '[]';
        out.add(at);
        requiredPaths(schema.items, manifest, at, out);
    }
    return out;
}

// The example with only the keys the schema requires, recursively.
function prune(value, schemaOrRef, manifest = loadManifest()) {
    const schema = resolve(schemaOrRef, manifest);
    if (!schema) return value;
    if (Array.isArray(value)) {
        return schema.items ? value.map((item) => prune(item, schema.items, manifest)) : value;
    }
    if (typeOf(value) === 'object') {
        const result = {};
        for (const key of schema.required || []) {
            if (value[key] !== undefined) {
                result[key] = schema.properties && schema.properties[key]
                    ? prune(value[key], schema.properties[key], manifest)
                    : value[key];
            }
        }
        return result;
    }
    return value;
}

function allowsNull(schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    return types.includes('null');
}

// The example with every value the schema allows to be null set to null.
function nulls(value, schemaOrRef, manifest = loadManifest()) {
    const schema = resolve(schemaOrRef, manifest);
    if (!schema) return value;
    if (value !== undefined && schema.type !== undefined && allowsNull(schema)) return null;
    if (Array.isArray(value)) {
        return schema.items ? value.map((item) => nulls(item, schema.items, manifest)) : value;
    }
    if (typeOf(value) === 'object') {
        const result = { ...value };
        for (const [key, child] of Object.entries(schema.properties || {})) {
            if (result[key] !== undefined) result[key] = nulls(result[key], child, manifest);
        }
        return result;
    }
    return value;
}

module.exports = {
    MANIFEST_PATH,
    loadManifest,
    templateName,
    checkMail,
    validate,
    declaredPaths,
    requiredPaths,
    prune,
    nulls
};
