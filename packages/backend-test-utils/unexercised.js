#!/usr/bin/env node
// Usage: node packages/backend-test-utils/unexercised.js <service> <hits file>...
//
// Lists documented responses (operation + status) that no test produced. The hits files
// are written by the response check when OPENAPI_HITS_FILE is set, one per CI shard.
// An operation may exempt one of its responses with x-untested: {'<status>': '<reason>'},
// which a reviewer approves. An exemption for a response that a test did produce is
// stale and fails too. Exits 1 when anything is left.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const { lintSpec, untestedExemptions, operations } = require('./spec-lint');

function findUnexercised(spec, hitLines) {
    const hits = new Set(hitLines);
    const { exemptions } = untestedExemptions(spec);
    const missing = [];
    // Placement and reasons of x-untested, and the other spec rules.
    const problems = lintSpec(spec);
    for (const { template, method, op } of operations(spec)) {
        for (const status of Object.keys(op.responses || {})) {
            const key = `${method.toUpperCase()} ${template} ${status}`;
            const exempt = exemptions.has(key);
            if (exempt && hits.has(key)) {
                problems.push(`${key}: x-untested is stale, a test produced this response; remove the exemption`);
            } else if (!exempt && !hits.has(key)) {
                missing.push(`${key}  (${op.operationId})`);
            }
        }
    }
    return { missing, problems };
}

// Lines starting with # (the run header) are not hits.
function readHits(hitFiles) {
    return hitFiles.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
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
    if (problems.length) console.log(`Spec problems:\n  ${problems.join('\n  ')}`);
    console.log(missing.length
        ? 'Documented but never exercised (write the test, or exempt the response on its operation with '
            + `x-untested: {'<status>': '<reason>'}):\n  ${missing.join('\n  ')}`
        : 'Every documented response was exercised.');
    process.exit(missing.length || problems.length ? 1 : 0);
}

module.exports = { findUnexercised, readHits };
