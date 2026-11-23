// The suite's checks of itself: the tests in ui/harness/must-fail/ each have to end the way
// ui/harness/self-check.spec.ts says (most of them have to fail, for a given reason). That spec
// starts this config as a run of its own and reads the result, so the checks are part of the
// mocked-API suite and nothing runs this file by hand. To look at one case while changing it:
//   npx playwright test -c playwright.selfcheck.config.ts --reporter=list
import { defineConfig } from '@playwright/test';

import base from './playwright.ui.config.ts';

export default defineConfig({
    ...base,
    testDir: './ui/harness/must-fail',
    testMatch: /\.case\.ts$/,
    forbidOnly: false,
    // The cases collect no coverage, and must not clear what the run around them collected.
    globalSetup: undefined,
    metadata: {},
    // One retry, as in CI: the case that passes on its retry has to fail the run all the same.
    retries: 1,
    // One worker: the test that waits for this run is idle meanwhile, so the run adds no load.
    workers: 1,
    outputDir: 'test-results-selfcheck',
    reporter: [
        ['json', { outputFile: 'test-results-selfcheck/results.json' }],
        ['./ui/support/no-expected-failures.ts']
    ],
    use: { ...base.use, trace: 'off', screenshot: 'off' },
    // The machinery is the same for both projects; one is enough.
    projects: base.projects!.filter((project) => project.name === 'vue')
});
