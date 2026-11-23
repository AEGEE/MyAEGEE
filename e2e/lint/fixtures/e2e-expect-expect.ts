// lint-as: ui/events/example.spec.ts
import type { Page } from '@playwright/test';

import { expectShape } from '../../support/contract.ts';
import { ok } from '../support/factories/base.ts';
import { expectEmptyTable, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const savedIsShown = async (page: Page): Promise<void> => {
    await expect(toast(page, 'Saved')).toBeVisible();
};
const viaAnotherFunction = async (page: Page): Promise<void> => savedIsShown(page);
const onlyClicks = async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Save' }).click();
};
const ACTIONS = ['View applications', 'Edit event'] as const;
async function whole({ page }: { page: Page }): Promise<void> {
    await page.goto('/events');
    await expect(page).toHaveTitle('MyAEGEE | List all events');
}
async function wholeWithoutAssertion({ page }: { page: Page }): Promise<void> {
    await page.goto('/events');
}

test.describe('tests that assert', () => {
    test('with expect', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();
    });

    test('with expect.poll', async ({ page, api }) => {
        await page.goto('/events');
        await expect.poll(() => api.callsTo('GET events /')).toHaveLength(1);
    });

    test('with expect.soft', async ({ page }) => {
        await page.goto('/events');
        await expect.soft(page).toHaveTitle('MyAEGEE | List all events');
    });

    test('with an expect in a callback', async ({ page, api }) => {
        api.on('POST core /renew', ({ body }) => {
            expect(body).toEqual({ refresh_token: 'mock-refresh-token' });
            return { json: { success: true } };
        });
        await page.goto('/events');
    });

    test('with one of the suite\'s asserting helpers', async ({ page }) => {
        await page.goto('/events');
        await expectEmptyTable(page.getByRole('table'));
    });

    test('with expectShape', () => {
        expectShape('event', {}, {});
    });

    test('with a function of this file that asserts', async ({ page }) => {
        await page.goto('/events');
        await savedIsShown(page);
    });

    test('with a function of this file that calls one that asserts', async ({ page }) => {
        await page.goto('/events');
        await viaAnotherFunction(page);
    });

    test('with a function of this file as its body', whole);

    test('with details and an assertion', { tag: '@phone-only' }, async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
    });

    test('in a loop over a list written out here', async ({ page }) => {
        for (const action of ['View applications', 'Edit event']) {
            await expect(page.getByRole('link', { name: action })).toBeVisible();
        }
    });

    test('in a loop over a list of this file', async ({ page }) => {
        for (const [index, action] of ACTIONS.entries()) {
            await expect(page.getByRole('link', { name: action })).toHaveAttribute('tabindex', String(index));
        }
        ACTIONS.forEach((action) => expect(action).not.toBe(''));
    });

    test('in a loop, after the number of items was asserted', async ({ page }) => {
        const rows = page.getByRole('row');
        await expect(rows).toHaveCount(3);
        for (const row of await rows.all()) await expect(row).toContainText('AEGEE');
    });
});

test.describe('tests that assert nothing', () => {
    // expect-lint: e2e-expect-expect
    test('only goes to a page', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        await page.getByRole('button', { name: 'Save' }).click();
    });

    // expect-lint: e2e-expect-expect
    test('has no body', async () => {});

    // expect-lint: e2e-expect-expect
    test('only uses a helper that doesn\'t assert', async ({ page }) => {
        await page.goto('/events');
        await onlyClicks(page);
        toast(page, 'Saved');
    });

    // expect-lint: e2e-expect-expect
    test('has a function without an assertion as its body', wholeWithoutAssertion);

    // expect-lint: e2e-expect-expect
    test('asserts only in a loop over what the page happens to show', async ({ page }) => {
        await page.goto('/events');
        for (const row of await page.getByRole('row').all()) {
            await expect(row).toContainText('AEGEE');
        }
    });

    // expect-lint: e2e-expect-expect
    test('asserts only once per item of a list that may be empty', async ({ page, api }) => {
        await page.goto('/events');
        api.callsTo('GET events /').forEach((call) => expect(call.status).toBe(200));
        for (let index = 0; index < api.calls.length; index++) expect(api.calls[index].handled).toBe(true);
        while (await page.getByRole('button', { name: 'Load more' }).isVisible()) await savedIsShown(page);
    });

    test.beforeEach(async ({ page }) => {
        // An assertion in a hook is not one of the test.
        await expect(page).toHaveTitle(/MyAEGEE/);
    });
    // expect-lint: e2e-expect-expect
    test('leaves the assertion to a hook', { tag: '@phone-only' }, async ({ page }) => {
        await page.goto('/events');
    });
});
