#!/usr/bin/env node
// Usage: node mailer/contract/check-senders.cjs
//
// Scans the services for the mails they send and compares them with mail-templates.json:
// every `template:` in a service's lib/ or middlewares/ must be a string literal naming a
// template of the contract, and the file must be listed in that template's `senders`.
// Every `senders` entry must still send the template, and every template has `senders` or
// `unused`. Exits 1 with one line per problem. No dependencies.

const fs = require('node:fs');
const path = require('node:path');

const { loadManifest, templateName } = require('./check-mail.cjs');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SERVICES = ['core', 'discounts', 'events', 'network', 'statutory', 'summeruniversity'];
const SOURCE_DIRS = ['lib', 'middlewares'];
// The mail clients pass the caller's template on.
const CLIENTS = new Set(SERVICES.map((service) => `${service}/lib/mailer.js`));

function listJs(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listJs(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

// Returns [{ file, line, template | undefined, source }] for every `template:` property.
function scanSenders(root = REPO_ROOT) {
    const found = [];
    for (const service of SERVICES) {
        for (const dir of SOURCE_DIRS) {
            for (const full of listJs(path.join(root, service, dir))) {
                const file = path.relative(root, full).split(path.sep).join('/');
                if (CLIENTS.has(file)) continue;
                const lines = fs.readFileSync(full, 'utf8').split('\n');
                lines.forEach((text, index) => {
                    const match = /(?:^|[\s{,])template\s*:\s*(.*)$/.exec(text);
                    if (!match || /^\s*(\/\/|\*)/.test(text)) return;
                    const literal = /^(['"`])([\w.-]+)\1\s*,?\s*(\/\/.*)?$/.exec(match[1].trim());
                    found.push({
                        file,
                        line: index + 1,
                        template: literal ? templateName(literal[2]) : undefined,
                        source: match[1].trim()
                    });
                });
            }
        }
    }
    return found;
}

function checkSenders(manifest = loadManifest(), root = REPO_ROOT) {
    const problems = [];
    const sent = scanSenders(root);
    const sentBy = new Map();

    for (const site of sent) {
        if (!site.template) {
            problems.push(`${site.file}:${site.line}: template is not a string literal (${site.source}); the contract check can't follow it`);
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

module.exports = { scanSenders, checkSenders, SERVICES };
