// lint-as: ui/harness/helpers.spec.ts
// lint-with-types
// This rule needs the types, so the fixture stands in for a file that exists.
import { test, expect } from '../support/test.ts';

test.describe('promises', () => {
    test('waited for', async ({ page }) => {
        await page.goto('/events');
        // Started before the click that causes it, awaited after.
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export' }).click();
        expect((await download).suggestedFilename()).toBe('events.xlsx');
        // Not a promise.
        expect(page.url()).toContain('/events');
    });

    test('not waited for', async ({ page }) => {
        // expect-lint: @typescript-eslint/no-floating-promises
        page.goto('/events');
        // expect-lint: @typescript-eslint/no-floating-promises
        page.getByRole('button', { name: 'Save' }).click();
        // expect-lint: @typescript-eslint/no-floating-promises, e2e-valid-expect
        expect(page.getByText('Saved')).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE');
    });
});
