// lint-as: ui/events/example.spec.ts
import { test, expect } from '../support/test.ts';
import { expectEmptyTable } from '../support/shell.ts';

test.describe('assertions under a condition', () => {
    test('without a condition', async ({ page, api }) => {
        await page.goto('/events');
        for (const name of ['Dashboard', 'Bodies']) {
            await expect(page.getByRole('link', { name })).toBeVisible();
        }
        // A condition inside what is asserted is fine: the assertion itself always runs.
        await expect.poll(() => (api.calls.length > 0 ? api.calls[0].status : 0)).toBe(200);
        expect(api.calls.length > 1 ? 'several' : 'one').toBe('one');
        try {
            await expect(page).toHaveTitle('MyAEGEE');
        } finally {
            await page.close();
        }
    });

    test('with conditions', async ({ page, api }) => {
        await page.goto('/events');
        const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
        // expect-lint: e2e-no-conditional-expect
        if (webgl) await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/**')).toHaveLength(1);

        if (webgl) {
            await page.reload();
        } else {
            // expect-lint: e2e-no-conditional-expect
            await expect(page.getByText('No map')).toBeVisible();
        }

        // expect-lint: e2e-no-conditional-expect
        await (webgl ? expect(page.getByText('Map')).toBeVisible() : page.reload());
        // expect-lint: e2e-no-conditional-expect
        if (webgl && (await expect(page.getByText('Map')).toBeVisible())) await page.reload();
        // expect-lint: e2e-no-conditional-expect
        if (!webgl) await expectEmptyTable(page.getByRole('table'));

        switch (api.calls.length) {
        case 0:
            // expect-lint: e2e-no-conditional-expect
            expect(api.unhandled).toEqual([]);
            break;
        default:
        }

        api.calls.forEach((call) => {
            // expect-lint: e2e-no-conditional-expect
            if (call.method === 'POST') expect(call.body).toBeTruthy();
        });
    });

    test('with try and catch', async ({ page }) => {
        try {
            // expect-lint: e2e-no-conditional-expect
            await expect(page.getByText('Saved')).toBeVisible();
        } catch {
            // expect-lint: e2e-no-conditional-expect
            await expect(page.getByText('Not saved')).toBeVisible();
        }
    });
});
