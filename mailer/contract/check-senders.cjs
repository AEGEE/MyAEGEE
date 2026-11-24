#!/usr/bin/env node
// Usage: node mailer/contract/check-senders.cjs
//
// Scans the services for the mails they send and compares them with mail-templates.json:
// every `template:` in a service's lib/ or middlewares/ must be a string literal naming a
// template of the contract (a shorthand `template` property can't be followed), and the file
// must be listed in that template's `senders`. Every `senders` entry must still send the
// template, and every template has `senders` or `unused`. sendMail must be used as
// `<client>.sendMail(...)` only: the services' jest hook (jest-hook.cjs) wraps the client
// module's export, so a destructured or saved sendMail would send mails it never sees.
// Exits 1 with one line per problem. No dependencies.

const fs = require('node:fs');
const path = require('node:path');

const { loadManifest, templateName } = require('./check-mail.cjs');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SERVICES = ['core', 'discounts', 'events', 'network', 'statutory', 'summeruniversity'];
const SOURCE_DIRS = ['lib', 'middlewares'];
// The mail clients pass the caller's template on.
const CLIENTS = new Set(SERVICES.map((service) => `${service}/lib/mailer.js`));

// A `template` shorthand property: on a line of its own, or inline in an object literal.
const SHORTHAND = [/^\s*template\s*,?\s*$/, /[{,]\s*template\s*[,}]/];
// Lines where `template` is a name being declared, not a property passed on: destructuring
// assignments and destructured parameters.
const DECLARATION = [/^\s*(const|let|var)\s*\{/, /\}\s*=(?![=>])/, /\(\s*\{[^}]*\}\s*\)\s*=>/, /function\b[^(]*\(\s*\{/];

function isComment(text) {
    return /^\s*(\/\/|\*|\/\*)/.test(text);
}

function listJs(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listJs(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

// Calls fn(file, lines) for every source file of the services but their mail clients.
function eachSource(root, fn) {
    for (const service of SERVICES) {
        for (const dir of SOURCE_DIRS) {
            for (const full of listJs(path.join(root, service, dir))) {
                const file = path.relative(root, full).split(path.sep).join('/');
                if (!CLIENTS.has(file)) fn(file, fs.readFileSync(full, 'utf8').split('\n'));
            }
        }
    }
}

// Returns [{ file, line, template | undefined, source }] for every `template:` property, and
// every shorthand `template` property (template undefined, source `template`).
function scanSenders(root = REPO_ROOT) {
    const found = [];
    eachSource(root, (file, lines) => {
        lines.forEach((text, index) => {
            if (isComment(text)) return;
            const match = /(?:^|[\s{,])template\s*:\s*(.*)$/.exec(text);
            if (match) {
                const literal = /^(['"`])([\w.-]+)\1\s*,?\s*(\/\/.*)?$/.exec(match[1].trim());
                found.push({
                    file,
                    line: index + 1,
                    template: literal ? templateName(literal[2]) : undefined,
                    source: match[1].trim()
                });
            } else if (SHORTHAND.some((re) => re.test(text)) && !DECLARATION.some((re) => re.test(text))) {
                found.push({ file, line: index + 1, template: undefined, source: 'template' });
            }
        });
    });
    return found;
}

// Returns [{ file, line, source }] for every use of sendMail that is not `.sendMail(`.
function scanClientUses(root = REPO_ROOT) {
    const found = [];
    eachSource(root, (file, lines) => {
        lines.forEach((text, index) => {
            if (isComment(text)) return;
            for (const match of text.matchAll(/\bsendMail\b/g)) {
                const before = text.slice(0, match.index);
                const after = text.slice(match.index + match[0].length);
                if (!/\.\s*$/.test(before) || !/^\s*\(/.test(after)) {
                    found.push({ file, line: index + 1, source: text.trim() });
                }
            }
        });
    });
    return found;
}

function checkSenders(manifest = loadManifest(), root = REPO_ROOT) {
    const problems = [];
    const sent = scanSenders(root);
    const sentBy = new Map();

    for (const use of scanClientUses(root)) {
        problems.push(`${use.file}:${use.line}: sendMail is used other than as <client>.sendMail(...) (${use.source}); `
            + 'the jest mail contract hook only sees calls through the client module: '
            + "require it as a module (const mailer = require('./mailer')) and call mailer.sendMail(...)");
    }

    for (const site of sent) {
        if (!site.template) {
            problems.push(`${site.file}:${site.line}: template is not a string literal (${site.source}); the contract check can't follow it: write template: '<name>.html'`);
            continue;
        }
        const entry = manifest.templates[site.template];
        if (!entry) {
            problems.push(`${site.file}:${site.line}: unknown template "${site.template}"; add it to mailer/contract/mail-templates.json and both renderers`);
            continue;
        }
        if (!(entry.senders || []).includes(site.file)) {
            problems.push(`${site.file}:${site.line}: sends "${site.template}", but the file is not in that template's senders`);
        }
        if (!sentBy.has(site.template)) sentBy.set(site.template, new Set());
        sentBy.get(site.template).add(site.file);
    }

    for (const [name, entry] of Object.entries(manifest.templates)) {
        const senders = entry.senders || [];
        if (senders.length === 0 && !entry.unused) {
            problems.push(`${name}: has neither senders nor an "unused" reason`);
        }
        if (senders.length > 0 && entry.unused) {
            problems.push(`${name}: has senders and is marked unused`);
        }
        for (const file of senders) {
            if (!(sentBy.get(name) || new Set()).has(file)) {
                problems.push(`${name}: sender ${file} does not send it (any more)`);
            }
        }
    }

    return { sites: sent, problems };
}

if (require.main === module) {
    const { sites, problems } = checkSenders();
    if (problems.length > 0) {
        for (const problem of problems) console.log(`FAIL: ${problem}`);
        process.exit(1);
    }
    console.log(`ok: ${sites.length} mail call sites, every template in mailer/contract/mail-templates.json`);
}

module.exports = { scanSenders, scanClientUses, checkSenders, SERVICES };
