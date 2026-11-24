// The contract agrees with itself, with both renderers' template sets and with the
// services' mail calls: node --test mailer/contract/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadManifest, checkMail, validate, prune, nulls, declaredPaths } = require('./check-mail.cjs');
const { checkSenders } = require('./check-senders.cjs');

const REPO_ROOT = path.join(__dirname, '..', '..');
const manifest = loadManifest();

function templateFiles(dir, suffix) {
    return fs.readdirSync(path.join(REPO_ROOT, dir))
        .filter((file) => file.endsWith(suffix))
        .map((file) => file.slice(0, -suffix.length))
        .sort();
}

test('every template has a description, a parameter schema and named examples', () => {
    for (const [name, entry] of Object.entries(manifest.templates)) {
        assert.equal(typeof entry.description, 'string', `${name}: description`);
        assert.equal(entry.parameters && entry.parameters.type, 'object', `${name}: parameters must be an object schema`);
        assert.ok(Array.isArray(entry.examples) && entry.examples.length > 0, `${name}: at least one example`);
        for (const example of entry.examples) {
            assert.equal(typeof example.name, 'string', `${name}: every example has a name`);
        }
    }
});

test('every sender file has an example of its own', () => {
    for (const [name, entry] of Object.entries(manifest.templates)) {
        const withExamples = new Set(entry.examples.map((example) => example.sender));
        for (const sender of entry.senders || []) {
            assert.ok(withExamples.has(sender), `${name}: no example for sender ${sender}`);
        }
        for (const example of entry.examples) {
            if (example.sender) assert.ok((entry.senders || []).includes(example.sender), `${name}: example "${example.name}" names a file that is not a sender`);
        }
    }
});

test('every example and its minimal and null variants are valid mails', () => {
    for (const [name, entry] of Object.entries(manifest.templates)) {
        for (const example of entry.examples) {
            for (const [variant, parameters] of Object.entries({
                full: example.parameters,
                minimal: prune(example.parameters, entry.parameters, manifest),
                nulls: nulls(example.parameters, entry.parameters, manifest)
            })) {
                const result = checkMail({ to: 'member@example.org', subject: 'Subject', template: `${name}.html`, parameters }, manifest);
                assert.deepEqual(result.errors, [], `${name} / ${example.name} / ${variant}`);
            }
        }
    }
});

test('every schema uses only the supported keywords and resolvable references', () => {
    validate({}, manifest.envelope, '', manifest, []);
    for (const def of Object.values(manifest.$defs)) declaredPaths(def, manifest);
    for (const [name, entry] of Object.entries(manifest.templates)) {
        // Validating the example walks every keyword that applies to it; walking the
        // declared paths resolves every reference.
        assert.doesNotThrow(() => validate(entry.examples[0].parameters, entry.parameters, '', manifest, []), name);
        assert.doesNotThrow(() => declaredPaths(entry.parameters, manifest), name);
    }
});

test('the contract, the mailer and the dispatcher have the same templates', () => {
    const contract = Object.keys(manifest.templates).sort();
    assert.deepEqual(templateFiles('mailer/lib/omsmailer_web/templates/page', '.html.eex'), contract, 'mailer templates/page');
    assert.deepEqual(templateFiles('dispatcher/templates', '.jinja2'), contract, 'dispatcher templates');
});

test('the services send only contract templates, from the files listed as senders', () => {
    const { sites, problems } = checkSenders(manifest);
    assert.deepEqual(problems, []);
    assert.ok(sites.length > 40, `expected the services' mail calls, found ${sites.length}`);
});
