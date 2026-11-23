// lint-as: ui/events/example.spec.ts
import { ok } from '../support/factories/base.ts';
import { test, expect } from '../support/test.ts';

const it = test;
// expect-lint: e2e-no-run-overrides
const RETRIED = { retries: 2 };

test.describe('how a spec may change its run', () => {
    test.describe.configure({ timeout: 60_000, mode: 'parallel' });

    test('takes longer', async ({ page }) => {
        test.slow();
        test.setTimeout(45_000);
        await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 });
        // A time, not a limit of the test.
        await page.getByRole('button', { name: 'Save' }).click({ timeout: 0 });
    });

    test('data with the same names is not a setting of the run', async ({ page, api }) => {
        const job = { retries: 3, mode: 'serial', timeout: 0 };
        api.json('GET core /jobs/1', ok(job));
        api.on('POST core /jobs', ({ body }) => ({ json: ok({ ...job, retries: (body as typeof job).retries }) }));
        await page.goto('/events');
        expect(api.callsTo('POST core /jobs').map((call) => call.body)).toEqual([{ retries: 3, mode: 'serial', timeout: 0 }]);
    });
});

test.describe('retries', () => {
    // expect-lint: e2e-no-run-overrides
    test.describe.configure({ retries: 2 });
    // expect-lint: e2e-no-run-overrides
    test.use({ retries: 1 } as never);
    // Reported where the object is written: the constant at the top of this file.
    it.describe.configure(RETRIED);

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
