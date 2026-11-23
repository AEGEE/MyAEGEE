// The suite has no expected failures, no skipped tests and no flaky tests: a page either works
// or its test is red. ESLint forbids test.skip, test.fixme and test.fail in ui/; this reporter
// catches what lint can't see (a skip inside a condition or a loop) and fails the run.
//
// CI retries a failed test once (playwright.ui.config.ts), which tells a test that fails
// sometimes from one that is broken. A test that passed on its retry is "flaky" for Playwright
// and would leave the run green; here it fails the run and is listed, so it gets fixed
// instead of being retried for ever.
//
// It also lists the tests that opt out of the phone project with @desktop-only, each with the
// reason its annotation gives, and writes them to test-results-ui/desktop-only.json.
//
// Only projects whose name starts with `vue` are checked.
import fs from 'node:fs';
import path from 'node:path';

import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

const CHECKED_PROJECT = /^vue/;

interface DesktopOnly {
    title: string;
    file: string;
    reason: string;
}

class NoExpectedFailures implements Reporter {
    private root: Suite | undefined;

    private outputDir = 'test-results-ui';

    onBegin(config: FullConfig, suite: Suite): void {
        this.root = suite;
        this.outputDir = config.projects[0]?.outputDir ?? path.join(config.rootDir, '..', 'test-results-ui');
    }

    onEnd(): Promise<{ status?: FullResult['status'] } | undefined> {
        return Promise.resolve(this.check());
    }

    private check(): { status?: FullResult['status'] } | undefined {
        if (!this.root) return undefined;
        const tests = this.root.allTests().filter((test) => CHECKED_PROJECT.test(test.parent.project()?.name ?? ''));
        const title = (test: TestCase): string => `[${test.parent.project()?.name}] ${test.titlePath().slice(3).join(' › ')}`;
        const location = (test: TestCase): string => `${path.relative(process.cwd(), test.location.file)}:${test.location.line}`;

        const desktopOnly: DesktopOnly[] = tests
            .filter((test) => test.tags.includes('@desktop-only'))
            .map((test) => ({
                title: test.titlePath().slice(3).join(' › '),
                file: location(test),
                reason: test.annotations.find((annotation) => annotation.type === 'desktop-only')?.description ?? ''
            }));
        fs.mkdirSync(this.outputDir, { recursive: true });
        fs.writeFileSync(path.join(this.outputDir, 'desktop-only.json'), `${JSON.stringify(desktopOnly, null, 2)}\n`);
        if (desktopOnly.length) {
            console.log(`\n${desktopOnly.length} test(s) run on the desktop project only:`);
            for (const test of desktopOnly) console.log(`  ${test.file} ${test.title}: ${test.reason || '(no reason given)'}`);
        }

        const offenders = [
            ...tests.filter((test) => test.expectedStatus !== 'passed').map((test) => `${location(test)} ${title(test)}: ${test.expectedStatus === 'skipped' ? 'skipped' : 'expected to fail'}`),
            ...tests.filter((test) => test.expectedStatus === 'passed' && test.results.length > 0 && test.outcome() === 'skipped').map((test) => `${location(test)} ${title(test)}: skipped`),
            ...tests.filter((test) => test.outcome() === 'flaky').map((test) => `${location(test)} ${title(test)}: passed only on a retry (flaky)`),
            ...desktopOnly.filter((test) => !test.reason.trim()).map((test) => `${test.file} ${test.title}: @desktop-only without a reason`)
        ];
        if (!offenders.length) return undefined;

        console.error(`\nThe suite has no skipped tests, no expected failures and no tests that pass only on a retry (docs/testing/writing-ui-specs.md), but found ${offenders.length}:`);
        for (const offender of offenders) console.error(`  ${offender}`);
        return { status: 'failed' };
    }

    // eslint-disable-next-line class-methods-use-this -- part of Playwright's reporter interface
    printsToStdio(): boolean {
        return false;
    }
}

export default NoExpectedFailures;
