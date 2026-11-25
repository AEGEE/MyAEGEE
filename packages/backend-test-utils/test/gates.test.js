// The three CI gates: the coverage ratchet, the never-exercised check and the
// after_n_builds check.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { checkCoverage, parseArgs } = require('../check-coverage');
const { findUnexercised, readHits } = require('../unexercised');
const { checkCoverageLowered, parseArgs: parseLoweredArgs } = require('../check-coverage-lowered');
const { carriesForward, checkCodecovBuilds } = require('../check-codecov-builds');
const { createContract } = require('../openapi');
const { FIXTURES, REQUIRE_FROM, tmpDir } = require('./helpers');

// An istanbul report for one file with four statements, one function and one
// two-way branch; `hits` says which statements this shard ran.
function report(file, hits, { fn = 0, branch = [0, 0] } = {}) {
    const loc = (line) => ({ start: { line, column: 0 }, end: { line, column: 10 } });
    return {
        [file]: {
            path: file,
            statementMap: { 0: loc(1), 1: loc(2), 2: loc(3), 3: loc(4) },
            fnMap: { 0: { name: 'f', decl: loc(1), loc: loc(1), line: 1 } },
            branchMap: { 0: { type: 'if', line: 2, loc: loc(2), locations: [loc(2), loc(3)] } },
            s: Object.fromEntries([0, 1, 2, 3].map((i) => [i, hits.includes(i) ? 1 : 0])),
            f: { 0: fn },
            b: { 0: branch }
        }
    };
}

function service(thresholds) {
    const dir = tmpDir('coverage');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ jest: { coverageThreshold: { global: thresholds } } }));
    return dir;
}

function writeReports(dir, reports) {
    return reports.map((r, i) => {
        const file = path.join(dir, `coverage-${i}.json`);
        fs.writeFileSync(file, JSON.stringify(r));
        return file;
    });
}

describe('check-coverage (the ratchet)', () => {
    const full = { statements: 100, branches: 100, functions: 100, lines: 100 };
    const shards = [report('/src/a.js', [0, 1], { fn: 1, branch: [1, 0] }), report('/src/a.js', [2, 3], { branch: [0, 1] })];

    test('one shard alone is below the thresholds', () => {
        const dir = service(full);
        const { failed, lines } = checkCoverage({ serviceRoot: dir, reports: writeReports(dir, shards.slice(0, 1)), requireFrom: REQUIRE_FROM });
        assert.equal(failed, true);
        assert.match(lines.join('\n'), /FAIL statements +50\.00% >= 100%/);
    });

    test('the merged shards pass where each shard alone would fail', () => {
        const dir = service(full);
        const { failed, summary } = checkCoverage({ serviceRoot: dir, reports: writeReports(dir, shards), requireFrom: REQUIRE_FROM });
        assert.equal(failed, false);
        assert.equal(summary.statements.pct, 100);
        assert.equal(summary.branches.pct, 100);
    });

    test('fails when the merged coverage drops below the ratchet', () => {
        const dir = service(full);
        const dropped = [shards[0], report('/src/a.js', [2], { branch: [0, 1] })];
        const { failed, lines } = checkCoverage({ serviceRoot: dir, reports: writeReports(dir, dropped), requireFrom: REQUIRE_FROM });
        assert.equal(failed, true);
        assert.match(lines.join('\n'), /FAIL statements +75\.00% >= 100%/);
        assert.match(lines.join('\n'), /ok {3}branches +100\.00% >= 100%/);
    });

    test('suggests raising a threshold that is 0.5 points or more below the merged number', () => {
        const dir = service({ statements: 90, branches: 99.8, functions: 100, lines: 100 });
        const { lines } = checkCoverage({ serviceRoot: dir, reports: writeReports(dir, shards), requireFrom: REQUIRE_FROM });
        assert.match(lines[0], /ok {3}statements 100\.00% >= 90% {2}\(raise to 100\)/);
        assert.doesNotMatch(lines[1], /raise/);
    });

    test('fails without reports, and when fewer reports than --expect arrive', () => {
        const dir = service(full);
        assert.throws(() => checkCoverage({ serviceRoot: dir, reports: [], requireFrom: REQUIRE_FROM }), /No coverage reports/);
        assert.throws(
            () => checkCoverage({ serviceRoot: dir, reports: writeReports(dir, shards.slice(0, 1)), expect: 2, requireFrom: REQUIRE_FROM }),
            /Expected 2 coverage report\(s\), got 1/
        );
        assert.deepEqual(parseArgs(['core', '--expect', '4', 'a.json', 'b.json']).expect, 4);
    });

    test('fails when the service has no ratchet, or an incomplete one', () => {
        const none = tmpDir('none');
        fs.writeFileSync(path.join(none, 'package.json'), '{"jest":{}}');
        assert.throws(
            () => checkCoverage({ serviceRoot: none, reports: writeReports(none, shards), requireFrom: REQUIRE_FROM }),
            /has no jest\.coverageThreshold\.global/
        );
        const partial = service({ statements: 90 });
        assert.throws(
            () => checkCoverage({ serviceRoot: partial, reports: writeReports(partial, shards), requireFrom: REQUIRE_FROM }),
            /missing: branches, functions, lines/
        );
    });
});

describe('unexercised (documented but never exercised)', () => {
    const { spec } = createContract({ serviceRoot: FIXTURES, requireFrom: REQUIRE_FROM });
    const allHits = [
        'GET /healthcheck 200', 'GET /metrics 200', 'GET /members/me 200', 'GET /members/me 401',
        'GET /members/{user_id} 200', 'GET /members/{user_id} 404', 'GET /courses 200', 'GET /courses 401',
        'POST /courses 201', 'POST /courses 401', 'POST /courses 422',
        'GET /courses/{course_id} 200', 'GET /courses/{course_id} 400', 'GET /courses/{course_id} 404',
        'DELETE /courses/{course_id} 204', 'DELETE /courses/{course_id} 404', 'GET /courses/{course_id}/export 200'
    ];

    test('passes when every documented response was hit; x-untested exempts POST /courses 403', () => {
        assert.deepEqual(findUnexercised(spec, allHits), { missing: [], problems: [] });
    });

    test('lists a documented response that no test produced', () => {
        const hits = allHits.filter((h) => h !== 'GET /courses/{course_id} 400');
        assert.deepEqual(findUnexercised(spec, hits).missing, ['GET /courses/{course_id} 400  (getCourse)']);
    });

    test('a 4XX range is a spec problem, and one 4xx hit does not exercise it', () => {
        const withRange = JSON.parse(JSON.stringify(spec));
        withRange.paths['/courses'].get.responses['4XX'] = withRange.paths['/courses'].get.responses['401'];
        const result = findUnexercised(withRange, [...allHits, 'GET /courses 404']);
        assert.deepEqual(result.missing, ['GET /courses 4XX  (listCourses)']);
        assert.match(result.problems.join('\n'), /GET \/courses 4XX \(listCourses\): .*'4XX' is not allowed/);
    });

    test('x-untested on a shared response exempts nothing and is a problem; an empty reason is a problem', () => {
        const withShared = JSON.parse(JSON.stringify(spec));
        withShared.components.responses.NotFound['x-untested'] = 'reason';
        withShared.paths['/courses/{course_id}'].get['x-untested'] = { 400: '' };
        const hits = allHits.filter((h) => h !== 'GET /courses/{course_id}/export 200' && !h.endsWith(' 404'));
        const result = findUnexercised(withShared, hits);
        assert.deepEqual(result.missing, [
            'GET /members/{user_id} 404  (getMember)',
            'GET /courses/{course_id} 404  (getCourse)',
            'DELETE /courses/{course_id} 404  (deleteCourse)',
            'GET /courses/{course_id}/export 200  (exportCourse)'
        ]);
        assert.match(result.problems.join('\n'), /#\/components\/responses\/NotFound: x-untested on a shared response would exempt every operation/);
        assert.match(result.problems.join('\n'), /GET \/courses\/\{course_id\} 400 \(getCourse\): x-untested needs a reason/);
    });

    test('an exemption for a response that a test produced is stale', () => {
        assert.deepEqual(findUnexercised(spec, [...allHits, 'POST /courses 403']).problems, [
            'POST /courses 403: x-untested is stale, a test produced this response; remove the exemption'
        ]);
    });

    test('the run header line of a hits file is not a hit', () => {
        const file = path.join(tmpDir('hits'), 'hits.txt');
        fs.writeFileSync(file, '# openapi hits, jest run 42\nGET /metrics 200\n');
        assert.deepEqual(readHits([file]), ['GET /metrics 200']);
    });

    test('the CLI exits 1 and names the gap', () => {
        const dir = tmpDir('cli');
        fs.copyFileSync(path.join(FIXTURES, 'openapi.yaml'), path.join(dir, 'openapi.yaml'));
        fs.copyFileSync(REQUIRE_FROM, path.join(dir, 'package.json'));
        fs.symlinkSync(path.join(path.dirname(REQUIRE_FROM), '..', 'node_modules'), path.join(dir, 'node_modules'));
        const hits = path.join(dir, 'hits.txt');
        fs.writeFileSync(hits, allHits.filter((h) => h !== 'GET /metrics 200').join('\n'));
        const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'unexercised.js'), dir, hits], { encoding: 'utf8' });
        assert.equal(run.status, 1);
        assert.match(run.stdout, /Documented but never exercised[^\n]*\n {2}GET \/metrics 200 {2}\(getMetrics\)/);
        fs.writeFileSync(hits, [...allHits, 'POST /courses 403'].join('\n'));
        const stale = spawnSync(process.execPath, [path.join(__dirname, '..', 'unexercised.js'), dir, hits], { encoding: 'utf8' });
        assert.equal(stale.status, 1);
        assert.match(stale.stdout, /POST \/courses 403: x-untested is stale/);
        fs.writeFileSync(hits, allHits.join('\n'));
        assert.match(
            execFileSync(process.execPath, [path.join(__dirname, '..', 'unexercised.js'), dir, hits], { encoding: 'utf8' }),
            /Every documented response was exercised/
        );
    });
});

describe('check-codecov-builds (after_n_builds)', () => {
    const carried = { flag_management: { individual_flags: [{ name: 'd', carryforward: true }] } };
    const codecov = (n, extra = carried) => ({ codecov: { notify: { after_n_builds: n } }, comment: { after_n_builds: n }, ...extra });
    const circle = {
        jobs: {
            'a-test': { parallelism: 3, steps: ['checkout', 'codecov/upload'] },
            'b-test': { steps: ['checkout', { 'codecov/upload': { flags: 'b' } }] },
            'c-test': { parallelism: 4, steps: ['checkout'] },
            'nightly-test': { parallelism: 2, steps: ['codecov/upload'] },
            'stable-test': { parallelism: 2, steps: ['codecov/upload'] },
            'd-test': { parallelism: 2, steps: ['checkout'] },
            'd-coverage': { steps: ['checkout', { 'codecov/upload': { flags: 'd', disable_search: true } }] }
        },
        workflows: {
            a: { jobs: ['a-test'] },
            d: { jobs: ['d-test', { 'd-coverage': { requires: ['d-test'] } }] },
            b: { jobs: [{ 'b-test': { filters: { branches: { ignore: 'stable' } } } }, 'c-test'] },
            nightly: { triggers: [{ schedule: { cron: '0 0 * * 5' } }], jobs: ['nightly-test'] },
            release: { jobs: [{ 'stable-test': { filters: { branches: { only: 'stable' } } } }] }
        }
    };

    test('counts parallelism 3, a job without parallelism as 1, and skips scheduled and stable-only uploads', () => {
        const result = checkCodecovBuilds(circle, codecov(5));
        assert.equal(result.ok, true, JSON.stringify(result.problems));
        assert.deepEqual(result.uploads.map((u) => `${u.job}:${u.parallelism}`), ['a-test:3', 'b-test:1']);
    });

    test('counts the upload of a job that only runs when the jobs it requires passed, as its flag is carried forward', () => {
        // Codecov counts the sessions of the commit's report. When d-coverage does not run,
        // the carried-forward copy of flag d is its session; when it runs, its upload
        // replaces the copy. So the report has 5 sessions once a-test and b-test are in,
        // whether d-coverage ran or not, and never 5 before.
        const result = checkCodecovBuilds(circle, codecov(5));
        assert.equal(result.expected, 5);
        assert.deepEqual(result.carried, [{ job: 'd-coverage', workflow: 'd', parallelism: 1, waitedFor: false, flags: ['d'] }]);
        assert.equal(checkCodecovBuilds(circle, codecov(4)).ok, false);

        // Without `requires` the same job uploads on every push and is waited for as well.
        const independent = { ...circle, workflows: { ...circle.workflows, d: { jobs: ['d-test', 'd-coverage'] } } };
        assert.equal(checkCodecovBuilds(independent, codecov(5, {})).ok, true);
        assert.deepEqual(checkCodecovBuilds(independent, codecov(5, {})).carried, []);
    });

    test('fails when the upload of a job that requires others is not carried forward', () => {
        // Counted, Codecov would wait forever after a failed d-test; not counted, the upload
        // of d-coverage could take the place of a shard of a-test that is not in yet.
        const result = checkCodecovBuilds(circle, codecov(5, {}));
        assert.equal(result.ok, false);
        assert.deepEqual(result.mismatches, []);
        assert.equal(result.problems.length, 1);
        assert.match(result.problems[0], /^d-coverage \(workflow d\) runs only when the jobs it requires passed, so its upload needs a flag with carryforward: true .*; d has none\.$/);

        const unflagged = { ...circle, jobs: { ...circle.jobs, 'd-coverage': { steps: ['codecov/upload'] } } };
        assert.match(checkCodecovBuilds(unflagged, codecov(5)).problems[0], /and it has no flag\.$/);

        // Every flag of the upload must be carried forward, or a session without it is missing.
        const twoFlags = { ...circle, jobs: { ...circle.jobs, 'd-coverage': { steps: [{ 'codecov/upload': { flags: 'd, e' } }] } } };
        assert.match(checkCodecovBuilds(twoFlags, codecov(5)).problems[0], /; e has none\.$/);
    });

    test('fails when an upload that runs on every push is carried forward', () => {
        // Its copy would be in the report from the first upload on, and Codecov would report
        // before b-test's own upload arrived.
        const result = checkCodecovBuilds(circle, codecov(5, { flag_management: { default_rules: { carryforward: true } } }));
        assert.equal(result.ok, false);
        assert.equal(result.problems.length, 1);
        assert.match(result.problems[0], /^b-test \(workflow b\) uploads on every push but its flag b has carryforward/);
    });

    test('resolves carryforward as Codecov does: flags first, then individual_flags, then default_rules', () => {
        assert.equal(carriesForward({}, 'd'), false);
        assert.equal(carriesForward(carried, 'd'), true);
        assert.equal(carriesForward({ flag_management: { default_rules: { carryforward: true } } }, 'd'), true);
        assert.equal(carriesForward({ flag_management: { default_rules: { carryforward: true }, individual_flags: [{ name: 'd', carryforward: false }] } }, 'd'), false);
        assert.equal(carriesForward({ flag_management: { default_rules: { carryforward: true }, individual_flags: [{ name: 'd' }] } }, 'd'), true);
        // A `flags:` entry wins, and without `carryforward` it means no carryforward.
        assert.equal(carriesForward({ ...carried, flags: { d: { paths: ['d/'] } } }, 'd'), false);
        assert.equal(carriesForward({ flags: { d: { carryforward: true } } }, 'd'), true);
    });

    test('fails on a mismatch, naming each wrong value', () => {
        const result = checkCodecovBuilds(circle, { ...carried, codecov: { notify: { after_n_builds: 5 } }, comment: { after_n_builds: 28 } });
        assert.equal(result.ok, false);
        assert.equal(result.expected, 5);
        assert.deepEqual(result.mismatches, [['comment.after_n_builds', 28]]);
    });

    test('the repository files agree', () => {
        const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-codecov-builds.js')], { encoding: 'utf8' });
        assert.equal(run.status, 0, run.stdout + run.stderr);
        assert.match(run.stdout, /frontend-coverage \(workflow frontend-tests\): 1, flag frontend: runs only when the jobs it requires passed, carried forward when it does not/);
    });
});

describe('check-coverage-lowered (lowering the ratchet needs an approved trailer)', () => {
    // A scratch repository: "stable" has the service's ratchet, the branch changes it.
    function repo(thresholds) {
        const dir = tmpDir('git');
        const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
        const write = (t) => {
            fs.mkdirSync(path.join(dir, 'svc'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'svc', 'package.json'), JSON.stringify({ jest: { coverageThreshold: { global: t } } }));
        };
        git('init', '-q', '-b', 'stable');
        write(thresholds);
        git('add', '.');
        git('commit', '-q', '-m', 'base');
        git('switch', '-q', '-c', 'branch');
        const commit = (t, message) => {
            if (t) write(t);
            git('commit', '-q', '--allow-empty', '-am', message);
        };
        const check = () => checkCoverageLowered({ repoRoot: dir, service: 'svc', base: 'stable' });
        return { commit, check };
    }
    const base = { statements: 90, branches: 80, functions: 85, lines: 90 };

    test('raising or keeping the numbers passes', () => {
        const { commit, check } = repo(base);
        commit({ ...base, branches: 81 }, 'raise');
        assert.deepEqual(check(), { failed: false, lines: ['svc: the coverage ratchet was not lowered'] });
    });

    test('lowering a number fails and names it', () => {
        const { commit, check } = repo(base);
        commit({ ...base, branches: 79.5, lines: 89 }, 'lower');
        const { failed, lines } = check();
        assert.equal(failed, true);
        assert.match(lines.join('\n'), /svc: this branch lowers the coverage ratchet in svc\/package\.json: branches 80 -> 79\.5, lines 90 -> 89\./);
        assert.match(lines.join('\n'), /Coverage-lowered: svc: <why>/);
    });

    test('removing the ratchet counts as lowering', () => {
        const { commit, check } = repo(base);
        commit({ statements: 90 }, 'remove');
        assert.match(check().lines[0], /branches 80 -> removed/);
    });

    test('a Coverage-lowered trailer for the service on the branch approves it; one for another service does not', () => {
        const { commit, check } = repo(base);
        commit({ ...base, branches: 79 }, 'lower\n\nCoverage-lowered: other: not this one');
        assert.equal(check().failed, true);
        commit(undefined, 'chore: note\n\nCoverage-lowered: svc: the removed export had the best-covered branches');
        assert.deepEqual(check(), {
            failed: false,
            lines: ['svc: coverage ratchet lowered (branches 80 -> 79), approved by a commit trailer: the removed export had the best-covered branches']
        });
    });

    test('the CLI takes several services and a base', () => {
        assert.deepEqual(parseLoweredArgs(['--base', 'origin/main', 'core', 'network']), { services: ['core', 'network'], base: 'origin/main' });
        assert.throws(() => parseLoweredArgs([]), /Usage/);
    });

    test('a service without a ratchet on the merge base has nothing to compare', () => {
        const { check } = repo(undefined);
        assert.equal(check().failed, false);
    });

    // The mailer's and the dispatcher's gates: a scratch repository whose "stable" has `file`
    // with `before`, and a branch that changes it to `after`.
    function fileRepo(file, before, after, message = 'change') {
        const dir = tmpDir('git');
        const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
        fs.mkdirSync(path.join(dir, 'svc'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'svc', file), before);
        git('init', '-q', '-b', 'stable');
        git('add', '.');
        git('commit', '-q', '-m', 'base');
        git('switch', '-q', '-c', 'branch');
        fs.writeFileSync(path.join(dir, 'svc', file), after);
        git('commit', '-q', '-am', message);
        return checkCoverageLowered({ repoRoot: dir, service: 'svc', base: 'stable' });
    }
    const coveralls = (minimum) => JSON.stringify({ skip_files: ['test/support'], coverage_options: { minimum_coverage: minimum } });
    const pyproject = (threshold) => `[tool.pytest.ini_options]\naddopts = "--cov=dispatcher --cov-branch --cov-fail-under=${threshold}"\n`;

    test('the mailer\'s minimum_coverage in coveralls.json is a ratchet too', () => {
        assert.deepEqual(fileRepo('coveralls.json', coveralls(96.6), coveralls(96.7)), { failed: false, lines: ['svc: the coverage ratchet was not lowered'] });
        const lowered = fileRepo('coveralls.json', coveralls(96.6), coveralls(95));
        assert.equal(lowered.failed, true);
        assert.match(lowered.lines[0], /svc: this branch lowers the coverage ratchet in svc\/coveralls\.json: lines 96\.6 -> 95\./);
        assert.match(fileRepo('coveralls.json', coveralls(96.6), JSON.stringify({ skip_files: [] })).lines[0], /lines 96\.6 -> removed/);
        assert.equal(fileRepo('coveralls.json', coveralls(96.6), coveralls(95), 'lower\n\nCoverage-lowered: svc: approved').failed, false);
    });

    test('the dispatcher\'s --cov-fail-under in pyproject.toml is a ratchet too', () => {
        assert.deepEqual(fileRepo('pyproject.toml', pyproject(99.5), pyproject(100)), { failed: false, lines: ['svc: the coverage ratchet was not lowered'] });
        const lowered = fileRepo('pyproject.toml', pyproject(100), pyproject(99.5));
        assert.equal(lowered.failed, true);
        assert.match(lowered.lines[0], /svc: this branch lowers the coverage ratchet in svc\/pyproject\.toml: total 100 -> 99\.5\./);
        assert.match(fileRepo('pyproject.toml', pyproject(100), '[tool.pytest.ini_options]\naddopts = "--cov=dispatcher"\n').lines[0], /total 100 -> removed/);
    });
});
