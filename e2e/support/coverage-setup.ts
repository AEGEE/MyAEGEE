// globalSetup of both Playwright configs: with E2E_COVERAGE=1, a run starts without the
// coverage files that earlier runs of the same suite left behind (see support/coverage.ts).
import type { FullConfig } from '@playwright/test';

import { clearSuiteData, coverageEnabled, type Suite } from './coverage.ts';

export default (config: FullConfig): void => {
    const suite = config.metadata.coverageSuite as Suite | undefined;
    if (!coverageEnabled || !suite) return;
    if (process.env.E2E_COVERAGE_KEEP === '1') {
        console.log(`Coverage: keeping what earlier runs of the ${suite} suite collected (E2E_COVERAGE_KEEP=1).`);
        return;
    }
    const removed = clearSuiteData(suite);
    if (removed > 0) console.log(`Coverage: removed ${removed} file(s) of an earlier run of the ${suite} suite, so the report is about this run.`);
};
