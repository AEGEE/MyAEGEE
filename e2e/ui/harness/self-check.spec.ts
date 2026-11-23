// The suite checks its own safety nets: the tests in ui/harness/must-fail/ are run as a
// separate Playwright run (playwright.selfcheck.config.ts), and each has to end the way the
// tests below say. This file is a project of its own (`self-check` in playwright.ui.config.ts),
// as the machinery is the same for both viewports. A net that stops catching (strict mode, the unused-handler check, the
// reporter that refuses skipped and flaky tests) turns one of these red.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { test, expect } from '../support/test.ts';

const E2E_DIR = path.resolve(import.meta.dirname, '../..');
const RESULTS = path.join(E2E_DIR, 'test-results-selfcheck/results.json');
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve('@playwright/test/cli');

interface CaseResult {
    // The status of every attempt, in order.
    attempts: string[];
    // Everything the attempts reported, as one text.
    errors: string;
    attachments: Record<string, string>;
}

interface Run {
    exitCode: number;
    output: string;
    cases: Map<string, CaseResult>;
}

interface JsonSuite {
    suites?: JsonSuite[];
    specs?: {
        title: string;
        tests: { results: { status: string; errors: { message?: string }[]; attachments: { name: string; body?: string }[] }[] }[];
    }[];
}

// eslint-disable-next-line no-control-regex -- the colours of Playwright's messages
const plain = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '');

let started: Promise<Run> | undefined;

// One run for all the tests of this file.
const selfCheck = (): Promise<Run> => {
    started ??= new Promise<Run>((resolve) => {
        // The run inside must not inherit what Playwright set for this worker, and it uses the
        // server that this run has started already.
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PW_|PLAYWRIGHT_(?!BROWSERS_PATH)|TEST_WORKER_INDEX$|TEST_PARALLEL_INDEX$|E2E_COVERAGE$|FORCE_COLOR$)/.test(key)));
        fs.rmSync(RESULTS, { force: true });
        execFile(process.execPath, [PLAYWRIGHT_CLI, 'test', '-c', 'playwright.selfcheck.config.ts'], {
            cwd: E2E_DIR,
            env: { ...env, E2E_REUSE: '1' },
            maxBuffer: 16 * 1024 * 1024
        }, (error, stdout, stderr) => {
            const cases = new Map<string, CaseResult>();
            const collect = (suite: JsonSuite): void => {
                for (const spec of suite.specs ?? []) {
                    const results = spec.tests.flatMap((item) => item.results);
                    cases.set(spec.title, {
                        attempts: results.map((result) => result.status),
                        errors: plain(results.flatMap((result) => result.errors.map((item) => item.message ?? '')).join('\n')),
                        attachments: Object.fromEntries(results.flatMap((result) => result.attachments.filter((item) => item.body).map((item) => [item.name, Buffer.from(item.body!, 'base64').toString('utf8')])))
                    });
                }
                (suite.suites ?? []).forEach(collect);
            };
            if (fs.existsSync(RESULTS)) collect(JSON.parse(fs.readFileSync(RESULTS, 'utf8')) as JsonSuite);
            const exitCode = error && typeof error.code === 'number' ? error.code : 0;
            resolve({ exitCode, output: plain(`${stdout}\n${stderr}`), cases });
        });
    });
    return started;
};

const caseOf = async (title: string): Promise<CaseResult> => {
    const run = await selfCheck();
    const found = run.cases.get(title);
    expect(found, `the case "${title}" ran. Output of the run:\n${run.output.slice(-3000)}`).toBeTruthy();
    return found!;
};

// All tests of the file in one worker, so the run inside happens once.
test.describe.configure({ mode: 'default' });

test.describe('the suite\'s own safety nets', () => {
    // The run inside starts its own browsers and makes its cases fail on purpose, most of them
    // twice, and two of them wait out the time a page gets to use a handler.
    test.beforeEach(() => test.setTimeout(120_000));

    test('the cases run, and a correct test passes among them', async () => {
        const run = await selfCheck();
        expect(run.exitCode, run.output.slice(-3000)).toBe(1);
        expect([...run.cases.keys()].sort()).toEqual([
            'a failed assertion comes with the requests nobody mocked',
            'a handler that no request matched',
            'a late request does not hide a handler that no request matched',
            'a request with a wrong address is not answered with the app',
            'a second page of the test is inside the mock',
            'a test that takes only the page is still logged in and strict',
            'a test that times out comes with the requests nobody mocked',
            'an uncaught error in a second page fails the test',
            'control: a request the page sends after the last assertion counts for its handler',
            'control: a test that mocks what the page asks for passes',
            'passes only on its retry',
            'skips itself while it runs'
        ]);
        expect((await caseOf('control: a test that mocks what the page asks for passes')).attempts).toEqual(['passed']);
    });

    test('a test that never asks for `api` is logged in and fails for a request nobody mocked', async () => {
        const result = await caseOf('a test that takes only the page is still logged in and strict');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('requests nobody mocked');
        expect(result.errors).toContain('GET /api/events/');
        // The only failure: the assertions of the test itself held.
        expect(result.errors).not.toContain('Alex Member');
        expect(result.errors).not.toContain('Could not fetch');
    });

    test('a second page of the test gets the session and the mock', async () => {
        const result = await caseOf('a second page of the test is inside the mock');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('requests nobody mocked');
        expect(result.errors).toContain('GET /api/statutory/');
        expect(result.errors).not.toContain('Alex Member');
        expect(result.errors).not.toContain('501');
    });

    test('an uncaught error in a second page fails the test', async () => {
        const result = await caseOf('an uncaught error in a second page fails the test');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('uncaught errors in the page');
        expect(result.errors).toContain('thrown in the second page');
    });

    test('a handler that no request matched fails the test and names the route', async () => {
        const result = await caseOf('a handler that no request matched');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('handlers that no request matched');
        expect(result.errors).toContain('GET events /singel/:id');
        expect(result.errors).not.toContain('"GET events /"');
    });

    // The list of unused handlers is not judged at the moment the test ends: the page gets
    // the time of an assertion to send what it has not sent yet (UNUSED_GRACE_MS in
    // ui/support/test.ts). Judged at once, this case fails.
    test('a request the page sends after the test\'s last assertion still counts', async () => {
        const result = await caseOf('control: a request the page sends after the last assertion counts for its handler');
        expect(result.errors).toBe('');
        expect(result.attempts).toEqual(['passed']);
    });

    test('a late request does not hide a handler that no request matched', async () => {
        const result = await caseOf('a late request does not hide a handler that no request matched');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('handlers that no request matched');
        expect(result.errors).toContain('GET events /singel/:id');
        // The handler that got its request late is not on the list.
        expect(result.errors).not.toContain('"GET events /"');
    });

    test('a request to this origin that is neither /api, a file of the build nor a page fails the test', async () => {
        const result = await caseOf('a request with a wrong address is not answered with the app');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('requests nobody mocked');
        for (const address of ['/apii/events/', '/api', '/API/events/']) {
            expect(result.errors).toMatch(new RegExp(`"GET http://127\\.0\\.0\\.1:\\d+${address}"`));
        }
        // The only failure: the page got a 404 for each, as the test itself asserts.
        expect(result.errors).not.toContain('404');
    });

    test('a failed assertion lists the requests nobody mocked next to it', async () => {
        const result = await caseOf('a failed assertion comes with the requests nobody mocked');
        expect(result.attempts).toEqual(['failed', 'failed']);
        expect(result.errors).toContain('Spring Training');
        expect(result.errors).toContain('requests nobody mocked (a likely reason for the failure above)');
        expect(result.attachments['requests nobody mocked']).toBe('GET /api/events/');
    });

    test('so does a test that ran into its timeout', async () => {
        const result = await caseOf('a test that times out comes with the requests nobody mocked');
        expect(result.attempts).toEqual(['timedOut', 'timedOut']);
        expect(result.errors).toContain('requests nobody mocked (a likely reason for the failure above)');
        expect(result.attachments['requests nobody mocked']).toBe('GET /api/events/');
    });

    test('a test that passed only on its retry fails the run', async () => {
        const run = await selfCheck();
        expect((await caseOf('passes only on its retry')).attempts).toEqual(['failed', 'passed']);
        expect(run.output).toMatch(/reporter\.case\.ts:\d+ \[vue\] passes only on its retry: passed only on a retry \(flaky\)/);
    });

    test('a test that skipped itself while running fails the run', async () => {
        const run = await selfCheck();
        expect((await caseOf('skips itself while it runs')).attempts).toEqual(['skipped']);
        expect(run.output).toMatch(/reporter\.case\.ts:\d+ \[vue\] skips itself while it runs: skipped/);
    });
});
