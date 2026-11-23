#!/usr/bin/env node
// Usage: node packages/backend-test-utils/check-coverage-lowered.js [--base <ref>] <service>...
//
// Fails when this branch lowers a number in <service>/package.json
// jest.coverageThreshold.global compared with its merge base with <ref> (default
// origin/stable), unless a commit on the branch carries the trailer
//
//   Coverage-lowered: <service>: <reason>
//
// The trailer is part of the pull request's commits, so the reviewer sees and approves it,
// and it applies to that branch only. Raising the numbers needs nothing.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function gitRunner(cwd) {
    return (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function thresholdsOf(manifestText) {
    const manifest = JSON.parse(manifestText);
    return (manifest.jest && manifest.jest.coverageThreshold && manifest.jest.coverageThreshold.global) || undefined;
}

function findLowered(before, after) {
    if (!before) return [];
    return METRICS
        .filter((m) => typeof before[m] === 'number' && !(typeof (after || {})[m] === 'number' && after[m] >= before[m]))
        .map((m) => ({ metric: m, from: before[m], to: after ? after[m] : undefined }));
}

function overrideReason(commitMessages, service) {
    const pattern = /^Coverage-lowered:[ \t]*([\w-]+):[ \t]*(.*\S)[ \t]*$/gim;
    for (const match of commitMessages.matchAll(pattern)) {
        if (match[1] === service) return match[2];
    }
    return undefined;
}

// Returns { lines, failed }.
function checkCoverageLowered({ repoRoot, service, base = 'origin/stable', git = gitRunner(repoRoot) }) {
    let mergeBase;
    try {
        mergeBase = git('merge-base', 'HEAD', base).trim();
    } catch (err) {
        throw new Error(`No merge base with ${base} (fetch it first: git fetch origin stable): ${err.message.split('\n')[0]}`);
    }
    const manifest = `${service}/package.json`;
    let before;
    try {
        before = thresholdsOf(git('show', `${mergeBase}:${manifest}`));
    } catch (err) { // eslint-disable-line no-unused-vars
        before = undefined; // a new service
    }
    if (!before) return { failed: false, lines: [`${service}: no coverage ratchet at the merge base, nothing to compare`] };

    const after = thresholdsOf(git('show', `HEAD:${manifest}`));
    const lowered = findLowered(before, after);
    if (lowered.length === 0) return { failed: false, lines: [`${service}: the coverage ratchet was not lowered`] };

    const list = lowered.map((l) => `${l.metric} ${l.from} -> ${l.to === undefined ? 'removed' : l.to}`).join(', ');
    const reason = overrideReason(git('log', '--format=%B', `${mergeBase}..HEAD`), service);
    if (reason) {
        return { failed: false, lines: [`${service}: coverage ratchet lowered (${list}), approved by a commit trailer: ${reason}`] };
    }
    return {
        failed: true,
        lines: [
            `${service}: this branch lowers the coverage ratchet in ${manifest}: ${list}.`,
            'Raise the coverage back, or, with the maintainer\'s approval, add this trailer to a commit message on the branch:',
            `  Coverage-lowered: ${service}: <why>`
        ]
    };
}

function parseArgs(argv) {
    const services = [];
    let base;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--base') base = argv[++i];
        else services.push(argv[i]);
    }
    if (services.length === 0) throw new Error('Usage: check-coverage-lowered.js [--base <ref>] <service>...');
    return { services, base };
}

if (require.main === module) {
    try {
        const { services, base } = parseArgs(process.argv.slice(2));
        const repoRoot = path.join(__dirname, '..', '..');
        let failed = false;
        for (const service of services) {
            // The service directory relative to the repository root, as git show needs it.
            const serviceDir = path.relative(repoRoot, path.resolve(service)).split(path.sep).join('/');
            const result = checkCoverageLowered({ repoRoot, service: serviceDir, base });
            console.log(result.lines.join('\n'));
            failed = failed || result.failed;
        }
        process.exit(failed ? 1 : 0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

module.exports = { checkCoverageLowered, findLowered, overrideReason, parseArgs };
