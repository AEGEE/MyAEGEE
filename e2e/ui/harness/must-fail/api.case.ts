// Tests that have to fail (or pass) in a known way: ui/harness/self-check.spec.ts runs them
// with playwright.selfcheck.config.ts and checks how each one ended. They are not part of the
// suite itself (their names don't end in .spec.ts).
import { ok } from '../../support/factories/base.ts';
import { toast } from '../../support/shell.ts';
import { test, expect } from '../../support/test.ts';

test('control: a test that mocks what the page asks for passes', async ({ page, api }) => {
    api.json('GET events /', ok([]));
    await page.goto('/events');
    await expect(page.getByText('No events found.')).toBeVisible();
});

test('a test that takes only the page is still logged in and strict', async ({ page }) => {
    await page.goto('/events');
    // The session is there without asking for `api`…
    await expect(page.getByRole('navigation', { name: 'Account' })).toContainText('Alex Member');
    // …and so is the check for the events request that nobody answered: the page got a 501 for it.
    await expect(toast(page, /Could not fetch events list/)).toBeVisible();
});

test('a second page of the test is inside the mock', async ({ page, context }) => {
    await page.goto('/about');
    await expect(page).toHaveTitle('MyAEGEE | About MyAEGEE');
    const second = await context.newPage();
    await second.goto('/about');
    await expect(second.getByRole('navigation', { name: 'Account' })).toContainText('Alex Member');
    expect(await second.evaluate(async () => (await fetch('/api/statutory/')).status)).toBe(501);
});

test('a handler that no request matched', async ({ page, api }) => {
    api.json('GET events /', ok([]));
    // The page asks for /single/:id: this one has a typo that is a valid route.
    api.json('GET events /singel/:id', ok({}));
    await page.goto('/events');
    await expect(page.getByText('No events found.')).toBeVisible();
});

test('a failed assertion comes with the requests nobody mocked', async ({ page }) => {
    await page.goto('/events');
    await expect(page.getByRole('link', { name: 'Spring Training' })).toBeVisible({ timeout: 1000 });
});

test('a test that times out comes with the requests nobody mocked', async ({ page }) => {
    test.setTimeout(3000);
    await page.goto('/events');
    await page.getByRole('button', { name: 'A button that is not there' }).click();
});

test('an uncaught error in a second page fails the test', async ({ page, context }) => {
    await page.goto('/about');
    const second = await context.newPage();
    await second.goto('/about');
    await second.evaluate(() => { setTimeout(() => { throw new Error('thrown in the second page'); }, 0); });
    await expect(second).toHaveTitle('MyAEGEE | About MyAEGEE');
    await expect.poll(() => second.evaluate(() => 1)).toBe(1);
});
