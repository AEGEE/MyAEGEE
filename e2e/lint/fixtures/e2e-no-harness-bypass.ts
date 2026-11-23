// lint-as: ui/events/example.spec.ts
// A spec stays inside the harness of ui/support/test.ts.
import type { Page } from '@playwright/test';
// expect-lint: e2e-no-harness-bypass
import { test as playwrightTest } from '@playwright/test';
// expect-lint: e2e-no-harness-bypass
import { expect as playwrightExpect, type Locator } from '@playwright/test';
// expect-lint: e2e-no-harness-bypass
import * as playwright from 'playwright';

import { expectShape } from '../../support/contract.ts';
// expect-lint: e2e-no-harness-bypass
import { test as realStackTest } from '../../support/api.ts';
import { ok } from '../support/factories/base.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';
// expect-lint: e2e-no-harness-bypass
import { test as ownTest } from './my-test.ts';

const heading = (page: Page): Locator => page.getByRole('heading', { level: 1 });

test.describe('inside the harness', () => {
    test.use({ session: 'board', tokens: 'both', area: 'events', allowedConsoleErrors: [/Network Error/], now: '2027-03-01T10:00:00+01:00' });
    // Playwright's own options for the browser are no fixtures of the harness.
    test.use({ locale: 'nl-NL', viewport: { width: 1600, height: 900 } });

    test('the page asks, and the mock says what it asked', async ({ page, api, me }) => {
        me!.first_name = 'Changed';
        api.json('GET events /', ok([]));
        const answered = page.waitForResponse('**/api/events/');
        await page.goto('/events');
        // The request of a response the page got, and of a route: calls, not Playwright's API client.
        expect((await answered).request().method()).toBe('GET');
        expect(await page.evaluate(async () => (await fetch('/api/events/')).status)).toBe(200);
        expect(api.callsTo('GET events /').map((call) => call.status)).toEqual([200, 200]);
        await expect(toast(page, 'Saved')).toBeHidden();
        await expect(heading(page)).toHaveText('Events');
        expectShape('event', {}, {});
    });
});

test.describe('requests from the test process', () => {
    test('through the page or its context', async ({ page, context }) => {
        // expect-lint: e2e-no-harness-bypass
        const response = await page.request.get('/api/events/');
        // expect-lint: e2e-no-harness-bypass
        await context.request.post('/api/events/', { data: {} });
        // expect-lint: e2e-no-harness-bypass
        await page.context().request.delete('/api/events/single/1');
        // expect-lint: e2e-no-harness-bypass
        const client = page['request'];
        expect([response.status(), await client.storageState()]).toHaveLength(2);
    });

    // expect-lint: e2e-no-harness-bypass
    test('through the request fixture', async ({ request }) => {
        expect((await request.get('/api/events/')).status()).toBe(200);
    });

    // expect-lint: e2e-no-harness-bypass
    test.beforeEach(async ({ playwright: library }) => {
        await library.selectors.register('x', () => ({}));
    });
});

// expect-lint: e2e-no-harness-bypass
const withoutChecks = test.extend({
    api: async ({ page }, use) => { await use(page as never); },
    pageErrors: [async ({ page }, use) => { await use(page as never); }, { auto: true }]
});
const base = test;
// expect-lint: e2e-no-harness-bypass
const alsoWithout = base.extend<{ consoleErrors: string[] }>({ consoleErrors: [] });
// expect-lint: e2e-no-harness-bypass
const merged = mergeTests(test, playwrightTest);

test.describe('fixtures of the harness replaced', () => {
    // expect-lint: e2e-no-harness-bypass
    test.use({ api: async ({ page }, use) => { await use(page as never); } });
    // expect-lint: e2e-no-harness-bypass, e2e-no-harness-bypass
    test.use({ pageErrors: [], consoleErrors: [] });
    // expect-lint: e2e-no-harness-bypass
    test.use({ storageState: { cookies: [], origins: [] } });
    // expect-lint: e2e-no-harness-bypass
    test.use({ layout: 'desktop' });
    test.use({
        session: 'member',
        // expect-lint: e2e-no-harness-bypass
        page: async ({ context }, use) => { await use(await context.newPage()); }
    } as never);

    test('still asserts something', async ({ page }) => {
        await expect(page).toHaveTitle('MyAEGEE');
        playwrightExpect([withoutChecks, alsoWithout, merged, ownTest, realStackTest, playwright]).toHaveLength(6);
    });
});

test('Playwright loaded while the test runs', async ({ page }) => {
    // expect-lint: e2e-no-harness-bypass
    const { chromium } = await import('playwright');
    // expect-lint: e2e-no-harness-bypass
    const { request: client } = require('@playwright/test') as typeof import('@playwright/test');
    await expect(page).toHaveTitle('MyAEGEE');
    expect([chromium, client]).toHaveLength(2);
});
