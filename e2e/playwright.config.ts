import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { serviceEnv, url, type Service } from './support/constants.ts';

const root = path.resolve(import.meta.dirname, '..');
// A busy port stops the run ("already used"): something else, most likely another checkout,
// runs a stack on this slot, and its services would answer instead of this checkout's.
// Pick another E2E_SLOT, or set E2E_REUSE=1 to use servers you started yourself.
const reuseExistingServer = !!process.env.E2E_REUSE;

const service = (name: Service) => ({
    command: 'node lib/run.js',
    cwd: path.join(root, name),
    env: serviceEnv(name),
    url: `${url(name)}/healthcheck`,
    reuseExistingServer,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
    timeout: 60 * 1000
});

export default defineConfig({
    testDir: './tests',
    // Tests share one database, so run them one at a time.
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    // With E2E_COVERAGE=1 a run starts without the coverage files of earlier real-stack runs.
    globalSetup: './support/coverage-setup.ts',
    metadata: { coverageSuite: 'real' },
    retries: 0,
    timeout: 30 * 1000,
    reporter: process.env.CI
        ? [['list'], ['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
        : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    use: {
        baseURL: url('gateway'),
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ],
    webServer: [
        {
            command: 'node support/fake-mailer.ts',
            url: `${url('mailer')}/healthcheck`,
            reuseExistingServer
        },
        {
            command: 'node support/fake-currency.ts',
            url: `${url('currency')}/healthcheck`,
            reuseExistingServer
        },
        service('core'),
        service('events'),
        service('summeruniversity'),
        service('statutory'),
        service('network'),
        service('discounts'),
        {
            command: 'node support/gateway.ts',
            url: url('gateway'),
            reuseExistingServer
        }
    ]
});
