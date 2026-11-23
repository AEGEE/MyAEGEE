#!/usr/bin/env node
// Usage: node packages/backend-test-utils/unexercised.js <service> <hits file>...
//
// Lists documented responses (operation + status) that no test produced. The hits files
// are written by the response check when OPENAPI_HITS_FILE is set, one per CI shard.
// A response may opt out with `x-untested: <reason>`, which a reviewer approves.
// Exits 1 when anything is left.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'trace'];

function resolveRef(spec, ref) {
    return ref.replace(/^#\//, '').split('/')
        .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce((acc, key) => (acc === undefined ? undefined : acc[key]), spec);
}

// x-untested may sit on the response itself or on the shared response it $refs.
function untestedReason(spec, response) {
    let current = response;
    const seen = new Set();
    while (current) {
        if (current['x-untested'] !== undefined) return current['x-untested'];
        if (!current.$ref || seen.has(current.$ref)) return undefined;
        seen.add(current.$ref);
        current = resolveRef(spec, current.$ref);
    }
    return undefined;
}

function findUnexercised(spec, hitLines) {
    const hits = new Set(hitLines);
    // "GET /x 4XX" is exercised by any 4xx hit on that operation.
    const rangeHits = new Set(hitLines.map((line) => line.replace(/ (\d)\d\d$/, ' $1XX')));
    const missing = [];
    const problems = [];
    for (const [template, item] of Object.entries(spec.paths || {})) {
        for (const method of METHODS) {
            const op = item[method];
            if (op) {
                for (const [status, response] of Object.entries(op.responses || {})) {
                    const key = `${method.toUpperCase()} ${template} ${status}`;
                    const reason = untestedReason(spec, response);
                    if (reason !== undefined && (typeof reason !== 'string' || reason.trim() === '')) {
                        problems.push(`${key}: x-untested needs a reason`);
                    }
                    const hit = /^\dXX$/i.test(status)
                        ? rangeHits.has(`${method.toUpperCase()} ${template} ${status.toUpperCase()}`)
                        : hits.has(key);
                    if (!hit && reason === undefined) missing.push(`${key}  (${op.operationId})`);
                }
            }
        }
    }
    return { missing, problems };
}

function readHits(hitFiles) {
    return hitFiles.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));
}

if (require.main === module) {
    const [service, ...hitFiles] = process.argv.slice(2);
    if (!service || hitFiles.length === 0) {
        console.error('Usage: unexercised.js <service> <hits file>...');
        process.exit(1);
    }
    const serviceRoot = path.resolve(service);
    const YAML = createRequire(path.join(serviceRoot, 'package.json'))('yaml');
    const spec = YAML.parse(fs.readFileSync(path.join(serviceRoot, 'openapi.yaml'), 'utf8'));
    const hitLines = readHits(hitFiles);
    if (hitLines.length === 0) {
        console.error('The hits files are empty: was OPENAPI_HITS_FILE set for the test run?');
        process.exit(1);
    }
    const { missing, problems } = findUnexercised(spec, hitLines);
    if (problems.length) console.log(`Invalid x-untested:\n  ${problems.join('\n  ')}`);
    console.log(missing.length
        ? `Documented but never exercised (write the test, or mark the response x-untested: <reason>):\n  ${missing.join('\n  ')}`
        : 'Every documented response was exercised.');
    process.exit(missing.length || problems.length ? 1 : 0);
}

module.exports = { findUnexercised, readHits, untestedReason };
