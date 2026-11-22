// The mocked-API suite: the frontend in a browser, with every /api call answered by the test
// (ui/support/api-mock.ts). It needs no services or database, so it's fast and runs in parallel.
// The real-stack suite is playwright.config.ts. See docs/react-migration/04-test-strategy.md.
//
// Projects:
//   vue    the Vue app on its own (today's production frontend);
//   react  the React app (frontend-react/) for the migrated paths, the Vue app for the rest.
//          Runs only the specs of migrated pages (tagged @migrated).
//
// Build the frontends first: `npm run setup:frontend` (or `npm run setup`, which also does the databases).
import { defineConfig, devices } from '@playwright/test';

const VUE_PORT = 18180;
const REACT_PORT = 18181;

const server = (port: number, mode: 'vue' | 'react') => ({
    command: `node ui/support/server.ts ${port} ${mode}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI
});

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
    reporter: process.env.CI
        ? [['list'], ['junit', { outputFile: 'test-results-ui/junit.xml' }], ['html', { open: 'never', outputFolder: 'playwright-report-ui' }]]
        : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-ui' }]],
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        // A fixed clock zone, so dates render the same everywhere.
        timezoneId: 'Europe/Brussels',
        locale: 'en-GB'
    },
    projects: [
        {
            name: 'vue',
            metadata: { frontend: 'vue' },
            use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${VUE_PORT}` }
        },
        {
            name: 'react',
            metadata: { frontend: 'react' },
            grep: /@migrated/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${REACT_PORT}` }
        }
    ],
    webServer: [server(VUE_PORT, 'vue'), server(REACT_PORT, 'react')]
});
