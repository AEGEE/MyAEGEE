// Unit tests of the contract validator: node --test mailer/contract/

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkMail, templateName, declaredPaths, requiredPaths, prune, nulls, validate } = require('./check-mail.cjs');

const manifest = {
    envelope: {
        type: 'object',
        required: ['to', 'subject', 'template', 'parameters'],
        properties: {
            to: { type: ['string', 'array'], minLength: 1, minItems: 1, items: { type: 'string', minLength: 1 } },
            subject: { type: 'string', minLength: 1 },
            template: { type: 'string' },
            parameters: { type: ['object', 'array'] },
            from: { type: ['string', 'null'], minLength: 1 }
        }
    },
    $defs: {
        questions: { type: 'array', items: { type: 'object', required: ['description'], properties: { description: { type: 'string' } } } },
        event: { type: 'object', required: ['name', 'questions'], properties: { name: { type: 'string' }, url: { type: ['string', 'null'] }, questions: { $ref: '#/$defs/questions' } } }
    },
    templates: {
        greet: {
            parameters: {
                type: 'object',
                required: ['name', 'event'],
                properties: { name: { type: 'string' }, nickname: { type: ['string', 'null'] }, event: { $ref: '#/$defs/event' }, kind: { enum: ['a', 'b'] } }
            }
        },
        custom: {
            per_recipient_parameters: true,
            parameters: { type: 'object', required: ['email_body'], properties: { email_body: { type: 'string' } } }
        },
        strict: {
            parameters: { type: 'object', required: [], properties: { a: { type: 'integer' } }, additionalProperties: false }
        }
    }
};

const event = { name: 'Agora', url: null, questions: [{ description: 'Why?' }] };
const mail = (overrides = {}) => ({ to: 'a@example.org', subject: 'Hi', template: 'greet.html', parameters: { name: 'Ada', event }, ...overrides });

test('a valid mail passes, with or without the .html suffix', () => {
    assert.deepEqual(checkMail(mail(), manifest), { ok: true, template: 'greet', unknownTemplate: false, errors: [] });
    assert.equal(checkMail(mail({ template: 'greet' }), manifest).ok, true);
});

test('templateName strips one .html suffix only', () => {
    assert.equal(templateName('a.html'), 'a');
    assert.equal(templateName('a'), 'a');
    assert.equal(templateName('a.html.html'), 'a.html');
    assert.equal(templateName(undefined), undefined);
});

test('an unknown template is reported as such', () => {
    const result = checkMail(mail({ template: 'nope.html' }), manifest);
    assert.equal(result.ok, false);
    assert.equal(result.unknownTemplate, true);
    assert.equal(result.errors[0], 'unknown template "nope"');
});

test('envelope problems are reported with their field', () => {
    const result = checkMail({ to: [], subject: '', template: 'greet', parameters: { name: 'Ada', event }, from: '' }, manifest);
    assert.deepEqual(result.errors.sort(), [
        'from: expected at least 1 character(s)',
        'subject: expected at least 1 character(s)',
        'to: expected at least 1 item(s)'
    ]);
    assert.deepEqual(checkMail({ template: 'greet' }, manifest).errors.sort(), ['parameters: missing', 'subject: missing', 'to: missing']);
    assert.deepEqual(checkMail(mail({ to: ['a@example.org', ''] }), manifest).errors, ['to[1]: expected at least 1 character(s)']);
});

test('parameter problems are all reported with their path', () => {
    const result = checkMail(mail({ parameters: { event: { name: 3, questions: [{ description: 'x' }, {}] }, kind: 'c' } }), manifest);
    assert.deepEqual(result.errors.sort(), [
        'parameters.event.name: expected string, got integer',
        'parameters.event.questions[1].description: missing',
        'parameters.kind: expected one of "a", "b", got "c"',
        'parameters.name: missing'
    ]);
});

test('null is only accepted where the schema allows it', () => {
    assert.equal(checkMail(mail({ parameters: { name: 'Ada', nickname: null, event } }), manifest).ok, true);
    assert.deepEqual(checkMail(mail({ parameters: { name: null, event } }), manifest).errors, ['parameters.name: expected string, got null']);
    assert.deepEqual(
        checkMail(mail({ parameters: { name: 'Ada', event: { ...event, questions: null } } }), manifest).errors,
        ['parameters.event.questions: expected array, got null']
    );
});

test('models are checked as they are sent: toJSON, dates and undefined values', () => {
    const model = { toJSON: () => ({ name: 'Ada', event, created: new Date(0) }) };
    assert.equal(checkMail(mail({ parameters: model }), manifest).ok, true);
    assert.equal(checkMail(mail({ parameters: { name: 'Ada', nickname: undefined, event } }), manifest).ok, true);
});

test('extra properties are allowed unless additionalProperties is false', () => {
    assert.equal(checkMail(mail({ parameters: { name: 'Ada', event, whole_model: { a: 1 } } }), manifest).ok, true);
    assert.deepEqual(checkMail(mail({ template: 'strict', parameters: { b: 1 } }), manifest).errors, ['parameters.b: not allowed']);
});

test('a list of parameters needs per-recipient parameters and one entry per address', () => {
    const body = { email_body: '<p>x</p>' };
    assert.equal(checkMail(mail({ template: 'custom', to: ['a@x.org', 'b@x.org'], parameters: [body, body] }), manifest).ok, true);
    assert.match(checkMail(mail({ template: 'custom', to: ['a@x.org', 'b@x.org'], parameters: [body] }), manifest).errors[0], /1 parameter object\(s\) for 2 recipient\(s\)/);
    assert.match(checkMail(mail({ template: 'custom', to: 'a@x.org', parameters: [body] }), manifest).errors[0], /needs one per address/);
    assert.deepEqual(checkMail(mail({ template: 'custom', to: ['a@x.org'], parameters: [{}] }), manifest).errors, ['parameters[0].email_body: missing']);
    assert.match(checkMail(mail({ parameters: [{ name: 'Ada', event }] }), manifest).errors[0], /takes one parameter object, not a list/);
});

test('unsupported schema keywords and unresolvable references are errors in the manifest', () => {
    assert.throws(() => validate('x', { type: 'string', pattern: '^x$' }, '', manifest, []), /Unsupported schema keyword "pattern"/);
    assert.throws(() => validate('x', { $ref: '#/$defs/missing' }, '', manifest, []), /Unresolvable \$ref/);
});

test('declaredPaths and requiredPaths follow references and list items', () => {
    const schema = manifest.templates.greet.parameters;
    assert.deepEqual([...declaredPaths(schema, manifest)].sort(), [
        'event', 'event.name', 'event.questions', 'event.questions.[]', 'event.questions.[].description', 'event.url', 'kind', 'name', 'nickname'
    ]);
    assert.deepEqual([...requiredPaths(schema, manifest)].sort(), [
        'event', 'event.name', 'event.questions', 'event.questions.[]', 'event.questions.[].description', 'name'
    ]);
});

test('prune keeps the required keys only and nulls sets every nullable value to null', () => {
    const schema = manifest.templates.greet.parameters;
    const example = { name: 'Ada', nickname: 'A', extra: 1, event: { ...event, url: 'agora', questions: [{ description: 'Why?', type: 'text' }] } };
    assert.deepEqual(prune(example, schema, manifest), { name: 'Ada', event: { name: 'Agora', questions: [{ description: 'Why?' }] } });
    assert.deepEqual(nulls(example, schema, manifest), { ...example, nickname: null, event: { ...example.event, url: null } });
});
