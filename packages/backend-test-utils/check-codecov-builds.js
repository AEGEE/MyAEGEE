#!/usr/bin/env node
// Usage: node packages/backend-test-utils/check-codecov-builds.js [<.circleci/config.yml> <codecov.yml>]
//
// Codecov waits for codecov.yml `after_n_builds` uploads before it reports. That number
// must equal the uploads one push makes whatever else happens in the pipeline: the sum of
// `parallelism` (default 1) over the CircleCI jobs with a codecov/upload step, counted once
// per workflow they run in.
// Not counted, because they don't upload on every push:
//   - workflows with `triggers` (scheduled) and job entries with a branch `only` filter;
//   - job entries that `requires` other jobs. Such a job only runs when those passed, so
//     Codecov must not wait for its upload: with a failed job in front of it the number would
//     never be reached, and Codecov would report nothing at all for the push. Its upload is
//     one more than Codecov waits for, and Codecov reports again when it arrives.
// Exits 1 with the expected value when either after_n_builds differs. yaml is resolved from
// core/, like the other scripts here.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const REPO_ROOT = path.join(__dirname, '..', '..');

function hasCodecovUpload(job) {
    return (job.steps || []).some((step) => step === 'codecov/upload'
        || (step && typeof step === 'object' && Object.prototype.hasOwnProperty.call(step, 'codecov/upload')));
}

// Returns [{ job, workflow, parallelism, waitedFor }] for every upload that runs on a push.
// `waitedFor` is false for a job that only runs when the jobs it requires passed.
function listUploads(circle) {
    const jobs = circle.jobs || {};
    const uploads = [];
    for (const [workflowName, workflow] of Object.entries(circle.workflows || {})) {
        if (workflow && typeof workflow === 'object' && !workflow.triggers) {
            for (const entry of workflow.jobs || []) {
                const name = typeof entry === 'string' ? entry : Object.keys(entry)[0];
                const settings = typeof entry === 'string' ? {} : (entry[name] || {});
                const jobName = settings.name || name;
                const job = jobs[name];
                const onlyBranches = settings.filters && settings.filters.branches && settings.filters.branches.only;
                if (job && hasCodecovUpload(job) && !onlyBranches) {
                    const parallelism = job.parallelism === undefined ? 1 : job.parallelism;
                    if (!Number.isInteger(parallelism) || parallelism < 1) {
                        throw new Error(`Job ${name}: parallelism ${JSON.stringify(parallelism)} is not a number this check can count`);
                    }
                    const requires = Array.isArray(settings.requires) ? settings.requires : [];
                    uploads.push({ job: jobName, workflow: workflowName, parallelism, waitedFor: requires.length === 0 });
                }
            }
        }
    }
    return uploads;
}

// The uploads Codecov waits for: [{ job, workflow, parallelism }].
function countUploads(circle) {
    return listUploads(circle).filter((u) => u.waitedFor).map(({ job, workflow, parallelism }) => ({ job, workflow, parallelism }));
}

function checkCodecovBuilds(circle, codecov) {
    const uploads = countUploads(circle);
    const extra = listUploads(circle).filter((u) => !u.waitedFor).map(({ job, workflow, parallelism }) => ({ job, workflow, parallelism }));
    const expected = uploads.reduce((sum, u) => sum + u.parallelism, 0);
    const actual = {
        'codecov.notify.after_n_builds': codecov && codecov.codecov && codecov.codecov.notify
            && codecov.codecov.notify.after_n_builds,
        'comment.after_n_builds': codecov && codecov.comment && codecov.comment.after_n_builds
    };
    const mismatches = Object.entries(actual).filter(([, value]) => value !== expected);
    return { expected, uploads, extra, actual, ok: mismatches.length === 0, mismatches };
}

if (require.main === module) {
    const [circlePath = path.join(REPO_ROOT, '.circleci', 'config.yml'), codecovPath = path.join(REPO_ROOT, 'codecov.yml')] = process.argv.slice(2);
    const YAML = createRequire(path.join(REPO_ROOT, 'core', 'package.json'))('yaml');
    const result = checkCodecovBuilds(
        YAML.parse(fs.readFileSync(circlePath, 'utf8')),
        YAML.parse(fs.readFileSync(codecovPath, 'utf8'))
    );
    for (const u of result.uploads) console.log(`  ${u.job} (workflow ${u.workflow}): ${u.parallelism}`);
    for (const u of result.extra) console.log(`  ${u.job} (workflow ${u.workflow}): ${u.parallelism}, not waited for: it runs only when the jobs it requires passed`);
    if (result.ok) {
        console.log(`ok: after_n_builds is ${result.expected}, one per upload above that Codecov waits for`);
        process.exit(0);
    }
    for (const [key, value] of result.mismatches) {
        console.log(`FAIL: ${key} is ${value}, expected ${result.expected}`);
    }
    console.log('Set both after_n_builds in codecov.yml to the expected value (docs/testing/backend-openapi.md).');
    process.exit(1);
}

module.exports = { checkCodecovBuilds, countUploads, listUploads };
