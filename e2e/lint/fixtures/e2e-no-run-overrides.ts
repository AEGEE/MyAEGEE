// lint-as: ui/events/example.spec.ts
import { test, expect } from '../support/test.ts';

test.describe('how a spec may change its run', () => {
    test.describe.configure({ timeout: 60_000, mode: 'parallel' });

    test('takes longer', async ({ page }) => {
        test.slow();
        test.setTimeout(45_000);
        await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 });
        // A time, not a limit of the test.
        await page.getByRole('button', { name: 'Save' }).click({ timeout: 0 });
    });
});

test.describe('retries', () => {
    // expect-lint: e2e-no-run-overrides
    test.describe.configure({ retries: 2 });
    // expect-lint: e2e-no-run-overrides
    test.use({ retries: 1 } as never);

    test('passes at some point', async ({ page }) => {
        await expect(page.getByText('Saved')).toBeVisible();
    });
});

test.describe('serial mode', () => {
    // expect-lint: e2e-no-run-overrides
    test.describe.configure({ mode: 'serial' });

    // expect-lint: e2e-no-run-overrides
    test.describe.serial('a serial group', () => {
        test('leans on the test before it', async ({ page }) => {
            await expect(page.getByText('Saved')).toBeVisible();
        });
    });
});

test.describe('no time limit', () => {
    // expect-lint: e2e-no-run-overrides
    test.describe.configure({ timeout: 0 });

    test('may hang', async ({ page }, testInfo) => {
        // expect-lint: e2e-no-run-overrides
        test.setTimeout(0);
        // expect-lint: e2e-no-run-overrides
        testInfo.setTimeout(0);
        await expect(page.getByText('Saved')).toBeVisible();
    });
});
