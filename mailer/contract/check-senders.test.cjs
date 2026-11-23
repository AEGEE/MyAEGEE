// Tests of the scan of the services' mail calls on a made-up repository:
// node --test mailer/contract/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkSenders, scanSenders } = require('./check-senders.cjs');

// A repository with core/lib/<file> holding `source`.
function repoWith(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-senders-'));
    for (const [file, source] of Object.entries(files)) {
        fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), source);
    }
    return root;
}

const manifest = { templates: { password_reset: { senders: ['core/lib/login.js'] } } };

test('a literal template name is found', () => {
    const root = repoWith({ 'core/lib/login.js': "mailer.sendMail({\n    to,\n    template: 'password_reset.html',\n    parameters\n});\n" });

    assert.deepEqual(scanSenders(root).map((s) => [s.file, s.line, s.template]), [['core/lib/login.js', 3, 'password_reset']]);
    assert.deepEqual(checkSenders(manifest, root).problems, []);
});

for (const [name, source] of [
    ['on a line of its own', 'mailer.sendMail({\n    to,\n    template,\n    parameters\n});\n'],
    ['last on a line of its own', 'mailer.sendMail({\n    to,\n    template\n});\n'],
    ['inline', 'await mailer.sendMail({ to, subject, template, parameters });\n'],
    ['inline and last', 'await mailer.sendMail({ to, template });\n']
]) {
    test(`a template passed as shorthand property ${name} is a problem`, () => {
        const root = repoWith({ 'core/lib/login.js': source });

        const { problems } = checkSenders({ templates: {} }, root);
        assert.equal(problems.length, 1, problems.join('\n'));
        assert.match(problems[0], /^core\/lib\/login\.js:\d+: template is not a string literal \(template\)/);
    });
}

test('a variable named template that is not a property passed on is not a mail call', () => {
    const root = repoWith({
        'core/lib/other.js': [
            'const { template } = options;',
            'const { template, other } = options;',
            'function render({ template }) {}',
            'const render2 = ({ template, x }) => x;',
            'const name = template;',
            'return template;',
            "const html = template.replace('a', 'b');",
            '// template, in a comment'
        ].join('\n')
    });

    assert.deepEqual(scanSenders(root), []);
});

for (const [name, source] of [
    ['destructured from the client', "const { sendMail } = require('./mailer');\n"],
    ['taken from the required client', "const send = require('./mailer').sendMail;\n"],
    ['kept in a variable', "const mailer = require('./mailer');\nconst send = mailer.sendMail;\n"],
    ['destructured from the client object', "const mailer = require('./mailer');\nconst { sendMail } = mailer;\n"]
]) {
    test(`sendMail ${name} is a problem: the jest hook only sees calls through the module`, () => {
        const root = repoWith({ 'core/lib/login.js': source });

        const { problems } = checkSenders({ templates: {} }, root);
        assert.equal(problems.length, 1, problems.join('\n'));
        assert.match(problems[0], /^core\/lib\/login\.js:\d+: sendMail is used other than as <client>\.sendMail\(\.\.\.\)/);
    });
}

test('calls through the client module are fine', () => {
    const root = repoWith({
        'core/lib/login.js': [
            "const mailer = require('./mailer');",
            'await mailer.sendMail({',
            "    template: 'password_reset.html'",
            '});',
            'await mailer',
            '    .sendMail({',
            "        template: 'password_reset.html'",
            '    });',
            '// const { sendMail } = mailer; in a comment',
            ''
        ].join('\n')
    });

    assert.deepEqual(checkSenders(manifest, root).problems, []);
});
