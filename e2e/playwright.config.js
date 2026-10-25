const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const { url } = require('./support/constants');

const root = path.resolve(__dirname, '..');
const serviceEnv = {
    NODE_ENV: 'e2e',
    LOGLEVEL: process.env.LOGLEVEL || 'warn'
};

const service = (name) => ({
    command: 'node lib/run.js',
    cwd: path.join(root, name),
    env: serviceEnv,
    url: `${url(name)}/healthcheck`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60 * 1000
});

module.exports = defineConfig({
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
            command: 'node support/fake-mailer.js',
            url: `${url('mailer')}/healthcheck`,
            reuseExistingServer: !process.env.CI
        },
        service('core'),
        service('events'),
        service('summeruniversity'),
        {
            command: 'node support/gateway.js',
            url: url('gateway'),
            reuseExistingServer: !process.env.CI
        }
    ]
});
