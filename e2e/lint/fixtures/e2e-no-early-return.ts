// lint-as: ui/events/example.spec.ts
import { ok } from '../support/factories/base.ts';
import { test, expect } from '../support/test.ts';

test.describe('returning', () => {
    test('a callback may return', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => {
            return { json: ok(query.get('search') ? [] : [{ id: 1 }]) };
        });
        const names = async () => {
            return page.getByRole('row').allInnerTexts();
        };
        const first = await test.step('a step returns its result', async () => {
            return (await names())[0];
        });
        await expect.poll(() => { return names(); }).toEqual([first]);
    });

    test('a test may not', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        const rows = await page.getByRole('row').count();
        // expect-lint: e2e-no-early-return
        if (rows === 0) return;
        await expect(page.getByRole('row')).toHaveCount(3);
    });

    test('not at its end either', async ({ page }) => {
        await expect(page).toHaveTitle('MyAEGEE');
        // expect-lint: e2e-no-early-return
        return;
    });

    test.beforeEach(async ({ page }) => {
        // A hook is not a test.
        if (page.url() !== 'about:blank') return;
        await page.goto('/events');
    });
});
