// The three CI gates: the coverage ratchet, the never-exercised check and the
// after_n_builds check.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { checkCoverage, parseArgs } = require('../check-coverage');
const { findUnexercised } = require('../unexercised');
const { checkCodecovBuilds } = require('../check-codecov-builds');
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
        'GET /members/{user_id} 200', 'GET /members/{user_id} 404', 'GET /courses 200', 'GET /courses 404',
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

    test('a 4XX response is exercised by any 4xx hit on the operation', () => {
        const hits = allHits.filter((h) => h !== 'GET /courses 404');
        assert.deepEqual(findUnexercised(spec, hits).missing, ['GET /courses 4XX  (listCourses)']);
        assert.deepEqual(findUnexercised(spec, [...hits, 'GET /courses 422']).missing, []);
    });

    test('x-untested on a shared $ref response applies to every use, and needs a reason', () => {
        const withShared = JSON.parse(JSON.stringify(spec));
        withShared.components.responses.NotFound['x-untested'] = 'reason';
        withShared.paths['/courses/{course_id}'].get.responses['400']['x-untested'] = '';
        const hits = allHits.filter((h) => !h.endsWith(' 404'));
        assert.deepEqual(findUnexercised(withShared, hits), {
            missing: ['GET /courses 4XX  (listCourses)'],
            problems: ['GET /courses/{course_id} 400: x-untested needs a reason']
        });
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
        fs.writeFileSync(hits, allHits.join('\n'));
        assert.match(
            execFileSync(process.execPath, [path.join(__dirname, '..', 'unexercised.js'), dir, hits], { encoding: 'utf8' }),
            /Every documented response was exercised/
        );
    });
});

describe('check-codecov-builds (after_n_builds)', () => {
    const codecov = (n) => ({ codecov: { notify: { after_n_builds: n } }, comment: { after_n_builds: n } });
    const circle = {
        jobs: {
            'a-test': { parallelism: 3, steps: ['checkout', 'codecov/upload'] },
            'b-test': { steps: ['checkout', { 'codecov/upload': { flags: 'b' } }] },
            'c-test': { parallelism: 4, steps: ['checkout'] },
            'nightly-test': { parallelism: 2, steps: ['codecov/upload'] },
            'stable-test': { parallelism: 2, steps: ['codecov/upload'] }
        },
        workflows: {
            a: { jobs: ['a-test'] },
            b: { jobs: [{ 'b-test': { filters: { branches: { ignore: 'stable' } } } }, 'c-test'] },
            nightly: { triggers: [{ schedule: { cron: '0 0 * * 5' } }], jobs: ['nightly-test'] },
            release: { jobs: [{ 'stable-test': { filters: { branches: { only: 'stable' } } } }] }
        }
    };

    test('counts parallelism 3, a job without parallelism as 1, and skips scheduled and stable-only uploads', () => {
        const result = checkCodecovBuilds(circle, codecov(4));
        assert.equal(result.ok, true);
        assert.deepEqual(result.uploads.map((u) => `${u.job}:${u.parallelism}`), ['a-test:3', 'b-test:1']);
    });

    test('fails on a mismatch, naming each wrong value', () => {
        const result = checkCodecovBuilds(circle, { codecov: { notify: { after_n_builds: 4 } }, comment: { after_n_builds: 28 } });
        assert.equal(result.ok, false);
        assert.equal(result.expected, 4);
        assert.deepEqual(result.mismatches, [['comment.after_n_builds', 28]]);
    });

    test('the repository files agree', () => {
        const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'check-codecov-builds.js')], { encoding: 'utf8' });
        assert.equal(run.status, 0, run.stdout + run.stderr);
    });
});
