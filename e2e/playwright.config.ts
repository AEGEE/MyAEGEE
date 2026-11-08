import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { url, type Service } from './support/constants.ts';

const root = path.resolve(import.meta.dirname, '..');
const serviceEnv = {
    NODE_ENV: 'e2e',
    LOGLEVEL: process.env.LOGLEVEL || 'warn'
};

const service = (name: Service) => ({
    command: 'node lib/run.js',
    cwd: path.join(root, name),
    env: serviceEnv,
    url: `${url(name)}/healthcheck`,
    reuseExistingServer: !process.env.CI,
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
            reuseExistingServer: !process.env.CI
        },
        service('core'),
        service('events'),
        service('summeruniversity'),
        {
            command: 'node support/gateway.ts',
            url: url('gateway'),
            reuseExistingServer: !process.env.CI
        }
    ]
});
