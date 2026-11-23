// What the reporter (ui/support/no-expected-failures.ts) has to catch although every test
// here ends "passed" or "skipped" for Playwright. See api.case.ts.
import { ok } from '../../support/factories/base.ts';
import { test, expect } from '../../support/test.ts';

test('passes only on its retry', async ({ page, api }, testInfo) => {
    api.json('GET events /', ok([]));
    await page.goto('/events');
    await expect(page.getByText(testInfo.retry === 0 ? 'Not on the page the first time' : 'No events found.')).toBeVisible({ timeout: 1000 });
});

test('skips itself while it runs', async ({ page }) => {
    await page.goto('/about');
    // eslint-disable-next-line e2e-no-skipped-tests -- the reporter has to catch what lint can't see; this is its test
    test.skip(await page.title() !== '', 'decided at run time');
    await expect(page).toHaveTitle('never checked');
});
