#!/usr/bin/env node
// Usage: node packages/backend-test-utils/check-coverage.js <service> [--expect <n>] <coverage-final.json>...
//
// The coverage ratchet. Merges the per-shard istanbul reports (CI runs each shard with
// --coverageThreshold='{}', because one shard alone never reaches the service's numbers)
// and checks the merged report against <service>/package.json jest.coverageThreshold.global,
// the same numbers an unsharded local `npm run test:ci` enforces.
// --expect <n> fails when fewer than n reports are given, so a lost shard cannot pass.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function readThresholds(serviceRoot) {
    const manifest = JSON.parse(fs.readFileSync(path.join(serviceRoot, 'package.json'), 'utf8'));
    const global = manifest.jest && manifest.jest.coverageThreshold && manifest.jest.coverageThreshold.global;
    if (!global) {
        throw new Error(`${path.join(serviceRoot, 'package.json')} has no jest.coverageThreshold.global`);
    }
    const missing = METRICS.filter((metric) => typeof global[metric] !== 'number');
    if (missing.length) {
        throw new Error(`jest.coverageThreshold.global needs all four metrics; missing: ${missing.join(', ')}`);
    }
    return global;
}

// Returns { lines, failed } for printing and the exit code.
function checkCoverage({ serviceRoot, reports, expect, requireFrom }) {
    if (reports.length === 0) throw new Error('No coverage reports given');
    if (expect !== undefined && reports.length < expect) {
        throw new Error(`Expected ${expect} coverage report(s), got ${reports.length}: a shard is missing`);
    }
    const { createCoverageMap } = createRequire(requireFrom || path.join(serviceRoot, 'package.json'))('istanbul-lib-coverage');
    const thresholds = readThresholds(serviceRoot);

    const map = createCoverageMap({});
    for (const report of reports) map.merge(JSON.parse(fs.readFileSync(report, 'utf8')));
    if (map.files().length === 0) throw new Error('The coverage reports contain no files');
    const summary = map.getCoverageSummary();

    let failed = false;
    const lines = [];
    for (const metric of METRICS) {
        const actual = summary[metric].pct;
        const minimum = thresholds[metric];
        const ok = actual >= minimum;
        failed = failed || !ok;
        const hint = actual - minimum >= 0.5 ? `  (raise to ${Math.floor(actual * 10) / 10})` : '';
        lines.push(`${ok ? 'ok  ' : 'FAIL'} ${metric.padEnd(10)} ${actual.toFixed(2)}% >= ${minimum}%${hint}`);
    }
    lines.push(`${reports.length} report(s), ${map.files().length} files`);
    return { lines, failed, summary };
}

function parseArgs(argv) {
    const [service, ...rest] = argv;
    let expect;
    const reports = [];
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--expect') {
            expect = parseInt(rest[++i], 10);
            if (!Number.isInteger(expect) || expect < 1) throw new Error('--expect needs a positive number');
        } else {
            reports.push(rest[i]);
        }
    }
    if (!service) throw new Error('Usage: check-coverage.js <service> [--expect <n>] <coverage-final.json>...');
    return { serviceRoot: path.resolve(service), reports, expect };
}

if (require.main === module) {
    try {
        const { lines, failed } = checkCoverage(parseArgs(process.argv.slice(2)));
        console.log(lines.join('\n'));
        if (failed) console.log('Coverage is below the ratchet in package.json (docs/testing/backend-openapi.md).');
        process.exit(failed ? 1 : 0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

module.exports = { checkCoverage, parseArgs, readThresholds };
