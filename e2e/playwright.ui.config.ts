// The mocked-API suite: the frontend in a browser, with every /api call answered by the test
// (ui/support/api-mock.ts). It needs no services or database, so it's fast and runs in parallel.
// The real-stack suite is playwright.config.ts. What each suite is for: docs/testing/README.md.
//
// Projects:
//   vue         the Vue app on a desktop viewport: everything except @phone-only tests;
//   vue-mobile  the same app on a phone (Pixel 7): everything except the axe run (@a11y) and
//               @desktop-only tests.
//
// Build the frontend first: `npm run setup:frontend` (or `npm run setup`, which also does the
// databases of the real stack).
import { defineConfig, devices } from '@playwright/test';

import { PORTS } from './support/constants.ts';

const baseURL = `http://127.0.0.1:${PORTS.mocked}`;

export default defineConfig({
    testDir: './ui',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    // The CI container sees all the host's CPUs (18 workers on a 4 vCPU `large` executor), which
    // starves the browsers and makes the axe runs time out. Match the executor instead.
    workers: process.env.CI ? 4 : undefined,
    timeout: 15 * 1000,
    expect: { timeout: 5 * 1000 },
    outputDir: 'test-results-ui',
    reporter: [
        ['list'],
        ['./ui/support/no-expected-failures.ts'],
        ...(process.env.CI ? [['junit', { outputFile: 'test-results-ui/junit.xml' }] as const] : []),
        ['html', { open: 'never', outputFolder: 'playwright-report-ui' }]
    ],
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        acceptDownloads: true,
        // A fixed clock zone and locale, so dates render the same everywhere.
        timezoneId: 'Europe/Brussels',
        locale: 'en-GB'
    },
    projects: [
        {
            name: 'vue',
            metadata: { frontend: 'vue', layout: 'desktop' },
            grepInvert: /@phone-only/,
            use: { ...devices['Desktop Chrome'] }
        },
        {
            name: 'vue-mobile',
            metadata: { frontend: 'vue', layout: 'phone' },
            grepInvert: /@a11y|@desktop-only/,
            use: { ...devices['Pixel 7'] }
        }
    ],
    webServer: {
        command: `node ui/support/server.ts ${PORTS.mocked}`,
        url: baseURL,
        // A busy port means another checkout runs on this slot (E2E_SLOT): stop, don't test its build.
        reuseExistingServer: !!process.env.E2E_REUSE
    }
});
