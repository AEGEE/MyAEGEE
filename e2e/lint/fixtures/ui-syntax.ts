// lint-as: ui/events/example.spec.ts
// The rules the suite had before: what a spec may rely on, and the tags it may carry.
import { freezeTime, openMenu, tableRows } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('what a spec may rely on', () => {
    test('roles, labels and text', async ({ page, layout }) => {
        await freezeTime(page);
        const menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Bodies' })).toBeVisible();
        await expect(page.getByLabel('Name')).toHaveValue('');
        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(page.getByTitle('More information')).toBeVisible();
        await expect(tableRows(page.getByRole('table'))).toHaveCount(3);
        // eslint-disable-next-line no-restricted-syntax -- the fixture shows that an exception with its reason is accepted
        await expect(page.locator('canvas')).toBeVisible();
    });

    test('not on classes, test ids, fixed waits or the app\'s internals', async ({ page }) => {
        // expect-lint: no-restricted-syntax
        await expect(page.locator('.button.is-primary')).toBeVisible();
        // expect-lint: no-restricted-syntax
        await expect(page.getByTestId('save')).toBeVisible();
        // expect-lint: no-restricted-syntax
        await expect(page.getByPlaceholder('Search')).toBeVisible();
        // expect-lint: no-restricted-syntax
        await expect(page.getByAltText('Logo')).toBeVisible();
        // expect-lint: no-restricted-syntax
        expect(await page.$('.button')).toBeTruthy();
        // expect-lint: no-restricted-syntax
        expect(await page.$$('.button')).toHaveLength(1);
        // expect-lint: no-restricted-syntax
        await page.waitForTimeout(500);
        // expect-lint: no-restricted-syntax
        expect(await page.evaluate(() => (document.querySelector('#app') as unknown as { __vue__: unknown }).__vue__)).toBeTruthy();
        // expect-lint: no-restricted-syntax
        expect(await page.evaluate(() => (window as unknown as { app: { $store: unknown } }).app.$store)).toBeTruthy();
    });

    test('not on what a phone doesn\'t show', async ({ page }) => {
        // expect-lint: no-restricted-syntax
        await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
        // expect-lint: no-restricted-syntax
        await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    });

    test('one browser context, the one with the mock and the session', async ({ page, context, browser }) => {
        const second = await context.newPage();
        await expect(second).toHaveTitle('MyAEGEE');
        // expect-lint: no-restricted-syntax
        const outside = await browser.newContext();
        // expect-lint: no-restricted-syntax
        const alsoOutside = await browser.newPage();
        await expect(await outside.newPage()).toHaveTitle('MyAEGEE');
        await expect(alsoOutside).toHaveTitle('MyAEGEE');
        await expect(page).toHaveTitle('MyAEGEE');
    });

    test('the clock is set through the helper', async ({ page }) => {
        // expect-lint: no-restricted-syntax
        await page.clock.install({ time: new Date('2027-03-01T10:00:00+01:00') });
        await expect(page).toHaveTitle('MyAEGEE');
    });

    test('an exception without its reason', async ({ page }) => {
        // expect-lint: @eslint-community/eslint-comments/require-description
        // eslint-disable-next-line no-restricted-syntax
        await expect(page.locator('canvas')).toBeVisible();
    });
});

test.describe('tags', () => {
    test('for the phone only', { tag: '@phone-only' }, async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
    });

    test('for the desktop only, with its reason', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'the phone has the sort select instead (covered by the next test)' }
    }, async ({ page }) => {
        await expect(page.getByRole('table')).toBeVisible();
    });

    // expect-lint: no-restricted-syntax
    test('for the desktop only, without a reason', { tag: '@desktop-only' }, async ({ page }) => {
        await expect(page.getByRole('table')).toBeVisible();
    });

    // expect-lint: no-restricted-syntax
    test('for the desktop only, with an empty reason', { tag: '@desktop-only', annotation: { type: 'desktop-only', description: ' ' } }, async ({ page }) => {
        await expect(page.getByRole('table')).toBeVisible();
    });

    // expect-lint: no-restricted-syntax
    test('with a tag of its own', { tag: '@slow' }, async ({ page }) => {
        await expect(page.getByRole('table')).toBeVisible();
    });

    // expect-lint: no-restricted-syntax
    test('with the tag of the generated tests', { tag: ['@phone-only', '@smoke'] }, async ({ page }) => {
        await expect(page.getByRole('table')).toBeVisible();
    });
});
