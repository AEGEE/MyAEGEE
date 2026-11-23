// lint-as: ui/events/example.spec.ts
import { test, expect } from '../support/test.ts';

test.describe('expectations that can fail', () => {
    test('awaited where they wait', async ({ page, api }) => {
        await expect(page.getByText('Saved')).toBeVisible();
        await expect(page.getByText('Saved')).not.toBeVisible();
        await expect.poll(() => api.calls.length).toBe(1);
        await expect(async () => {
            expect(api.calls).toHaveLength(1);
        }).toPass();
        await expect(page.evaluate(() => 1)).resolves.toBe(1);
        await Promise.all([
            expect(page).toHaveTitle('MyAEGEE'),
            expect(page).toHaveURL('/events')
        ]);
        // These don't wait for anything.
        expect(api.unhandled).toEqual([]);
        expect(api.calls.map((call) => call.status)).toContain(200);
        expect.soft(await page.title(), 'the title').toBe('MyAEGEE');
        const visible = expect(page.getByText('Saved')).toBeVisible();
        await visible;
    });
});

test.describe('expectations that can\'t', () => {
    test('without a matcher', async ({ page, api }) => {
        // expect-lint: e2e-valid-expect
        expect(page.getByText('Saved'));
        // expect-lint: e2e-valid-expect
        expect(api.calls).not;
        // expect-lint: e2e-valid-expect
        await expect.poll(() => api.calls.length);
        await expect(page).toHaveTitle('MyAEGEE');
    });

    test('about a constant', () => {
        // expect-lint: e2e-valid-expect
        expect(true).toBe(true);
        // expect-lint: e2e-valid-expect
        expect(1).toBeTruthy();
        // expect-lint: e2e-valid-expect
        expect('done').toBe('done');
        // expect-lint: e2e-valid-expect
        expect(`done`).toHaveLength(4);
        // expect-lint: e2e-valid-expect
        expect(undefined).toBeUndefined();
        // expect-lint: e2e-valid-expect
        expect(null).toBeNull();
        // expect-lint: e2e-valid-expect
        expect().toBeUndefined();
        // expect-lint: e2e-valid-expect
        expect.soft(true).toBe(true);
    });

    test('not awaited', async ({ page, api }) => {
        // expect-lint: e2e-valid-expect
        expect(page.getByText('Saved')).toBeVisible();
        // expect-lint: e2e-valid-expect
        expect(page.getByText('Saved')).not.toHaveText('Not saved');
        // expect-lint: e2e-valid-expect
        expect(page).toHaveURL('/events');
        // expect-lint: e2e-valid-expect
        expect.poll(() => api.calls.length).toBe(1);
        // expect-lint: e2e-valid-expect
        expect(async () => { expect(api.calls).toHaveLength(1); }).toPass();
        // expect-lint: e2e-valid-expect
        expect(page.evaluate(() => 1)).resolves.toBe(1);
        // expect-lint: e2e-valid-expect
        expect.soft(page.getByRole('row')).toHaveCount(3);
    });

    test('with its failure caught', async ({ page }) => {
        // expect-lint: e2e-valid-expect
        await expect(page.getByText('Saved')).toBeVisible().catch(() => {});
        // expect-lint: e2e-valid-expect
        await expect(page.getByText('Saved')).toBeVisible({ timeout: 100 }).catch(() => undefined);
    });
});
