#!/usr/bin/env node
// Usage: node packages/backend-test-utils/check-codecov-builds.js [<.circleci/config.yml> <codecov.yml>]
//
// Codecov reports on a commit once its report has codecov.yml `after_n_builds` sessions.
// Each upload is one session, and a carried-forward copy of a flag's coverage
// (`carryforward: true`) is one too: Codecov copies it from the parent commit when the commit's
// first upload arrives, and the real upload of that flag replaces it. So the number must equal
// the sum of `parallelism` (default 1) over the CircleCI jobs with a codecov/upload step,
// counted once per workflow they run in, and these rules keep it reachable but never early:
//   - A job entry that `requires` other jobs only runs when those passed. Its upload must have
//     a carryforward flag: when the job does not run, the carried-forward copy stands in for
//     it, and when it runs, its upload replaces the copy instead of adding one more. Without
//     carryforward, counting it would leave Codecov waiting forever after a failed job in front
//     of it, and not counting it would let it fill the place of a service shard that is not in
//     yet, so that Codecov reports with that shard missing.
//   - Every other upload must not have a carryforward flag: its copy would count from the
//     first upload on, and Codecov would report before the upload itself arrived.
// Not counted, because they don't upload on every push: workflows with `triggers` (scheduled)
// and job entries with a branch `only` filter.
// Exits 1 with the expected value when either after_n_builds differs or an upload breaks a
// rule. yaml is resolved from core/, like the other scripts here.

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const REPO_ROOT = path.join(__dirname, '..', '..');

function uploadStep(job) {
    for (const step of job.steps || []) {
        if (step === 'codecov/upload') return {};
        if (step && typeof step === 'object' && Object.prototype.hasOwnProperty.call(step, 'codecov/upload')) {
            return step['codecov/upload'] || {};
        }
    }
    return undefined;
}

// The orb's `flags` parameter: a comma-separated string.
function flagsOf(step) {
    return String(step.flags || '').split(',').map((f) => f.trim()).filter(Boolean);
}

// Returns [{ job, workflow, parallelism, waitedFor, flags }] for every upload that runs on a
// push. `waitedFor` is false for a job that only runs when the jobs it requires passed.
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
                const step = job && uploadStep(job);
                const onlyBranches = settings.filters && settings.filters.branches && settings.filters.branches.only;
                if (step && !onlyBranches) {
                    const parallelism = job.parallelism === undefined ? 1 : job.parallelism;
                    if (!Number.isInteger(parallelism) || parallelism < 1) {
                        throw new Error(`Job ${name}: parallelism ${JSON.stringify(parallelism)} is not a number this check can count`);
                    }
                    const requires = Array.isArray(settings.requires) ? settings.requires : [];
                    uploads.push({ job: jobName, workflow: workflowName, parallelism, waitedFor: requires.length === 0, flags: flagsOf(step) });
                }
            }
        }
    }
    return uploads;
}

// Whether Codecov carries `flag` forward, resolved as Codecov does: a `flags.<flag>` entry
// wins (without `carryforward` it is not carried), then a `flag_management.individual_flags`
// entry that sets `carryforward`, then `flag_management.default_rules.carryforward`.
function carriesForward(codecov, flag) {
    const legacy = codecov && codecov.flags && codecov.flags[flag];
    if (legacy) return legacy.carryforward === true;
    const management = (codecov && codecov.flag_management) || {};
    const individual = (management.individual_flags || []).find((f) => f && f.name === flag);
    if (individual && typeof individual.carryforward === 'boolean') return individual.carryforward;
    return Boolean(management.default_rules && management.default_rules.carryforward === true);
}

function problemsOf(uploads, codecov) {
    const problems = [];
    for (const u of uploads) {
        const carried = u.flags.filter((f) => carriesForward(codecov, f));
        if (u.waitedFor && carried.length > 0) {
            problems.push(`${u.job} (workflow ${u.workflow}) uploads on every push but its flag ${carried.join(', ')} has carryforward: Codecov would count the carried-forward copy before the upload arrives. Remove carryforward for it in codecov.yml.`);
        }
        if (!u.waitedFor && (u.flags.length === 0 || carried.length < u.flags.length)) {
            problems.push(`${u.job} (workflow ${u.workflow}) runs only when the jobs it requires passed, so its upload needs a flag with carryforward: true in codecov.yml (flag_management.individual_flags)${u.flags.length ? `; ${u.flags.filter((f) => !carried.includes(f)).join(', ')} has none` : ', and it has no flag'}.`);
        }
    }
    return problems;
}

function checkCodecovBuilds(circle, codecov) {
    const all = listUploads(circle);
    const uploads = all.filter((u) => u.waitedFor);
    const carried = all.filter((u) => !u.waitedFor);
    const expected = all.reduce((sum, u) => sum + u.parallelism, 0);
    const actual = {
        'codecov.notify.after_n_builds': codecov && codecov.codecov && codecov.codecov.notify
            && codecov.codecov.notify.after_n_builds,
        'comment.after_n_builds': codecov && codecov.comment && codecov.comment.after_n_builds
    };
    const mismatches = Object.entries(actual).filter(([, value]) => value !== expected);
    const problems = problemsOf(all, codecov);
    return { expected, uploads, carried, actual, ok: mismatches.length === 0 && problems.length === 0, mismatches, problems };
}

if (require.main === module) {
    const [circlePath = path.join(REPO_ROOT, '.circleci', 'config.yml'), codecovPath = path.join(REPO_ROOT, 'codecov.yml')] = process.argv.slice(2);
    const YAML = createRequire(path.join(REPO_ROOT, 'core', 'package.json'))('yaml');
    const result = checkCodecovBuilds(
        YAML.parse(fs.readFileSync(circlePath, 'utf8')),
        YAML.parse(fs.readFileSync(codecovPath, 'utf8'))
    );
    for (const u of result.uploads) console.log(`  ${u.job} (workflow ${u.workflow}): ${u.parallelism}`);
    for (const u of result.carried) {
        console.log(`  ${u.job} (workflow ${u.workflow}): ${u.parallelism}, flag ${u.flags.join(', ') || '(none)'}: runs only when the jobs it requires passed, carried forward when it does not`);
    }
    if (result.ok) {
        console.log(`ok: after_n_builds is ${result.expected}, one per upload above`);
        process.exit(0);
    }
    for (const problem of result.problems) console.log(`FAIL: ${problem}`);
    for (const [key, value] of result.mismatches) {
        console.log(`FAIL: ${key} is ${value}, expected ${result.expected}`);
    }
    if (result.mismatches.length) console.log('Set both after_n_builds in codecov.yml to the expected value (docs/testing/coverage.md).');
    process.exit(1);
}

module.exports = { checkCodecovBuilds, carriesForward, listUploads };
