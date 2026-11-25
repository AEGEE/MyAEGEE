// The list of discount integrations (/discounts/integrations): the partners whose codes members
// claim, where discounts managers create and edit them and add codes. Members only; the
// discounts service lets only holders of a `manage:discounts` permission change them.
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { integration } from '../support/factories/discounts.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const FLIXBUS = integration({ id: 1, name: 'Flixbus', code: 'flixbus', description: 'Use the code on **flixbus.com**.', quota_amount: 2, quota_period: 'month' });
const HOSTELWORLD = integration({ id: 2, name: 'Hostelworld', code: 'hostelworld', description: 'No booking fee.', quota_amount: 1, quota_period: 'year' });

const list = (page: Page) => page.getByRole('article', { name: 'Discounts integrations list' });
const table = (page: Page) => list(page).getByRole('table');

test.describe('discount integrations list', () => {
    test.describe('for a discounts manager', () => {
        test.use({ session: 'superadmin' });

        test('lists every integration with its quota, and the ways to create, edit and add codes', async ({ page, api }) => {
            api.json('GET discounts /integrations', ok([FLIXBUS, HOSTELWORLD]));

            await page.goto('/discounts/integrations');

            await expect(list(page).getByRole('link', { name: 'Create integration' })).toHaveAttribute('href', '/discounts/integrations/new');
            const rows = tableRows(table(page));
            await expect(rows).toHaveCount(2);
            await expect(await cellOf(table(page), rows.first(), 'Name')).toHaveText('Flixbus');
            await expect(await cellOf(table(page), rows.first(), 'Code')).toHaveText('flixbus');
            await expect((await cellOf(table(page), rows.first(), 'Description')).getByRole('strong')).toHaveText('flixbus.com');
            await expect(await cellOf(table(page), rows.first(), 'Quota')).toHaveText('2/month');
            await expect(await cellOf(table(page), rows.nth(1), 'Quota')).toHaveText('1/year');
            await expect(list(page).getByRole('link', { name: 'Edit integration Hostelworld' })).toHaveAttribute('href', '/discounts/integrations/2/edit');
            await expect(list(page).getByRole('link', { name: 'Add codes to Flixbus' })).toHaveAttribute('href', '/discounts/integrations/1/add-codes');
            // The app asked for the permissions once, when it started; the page didn't ask again.
            expect(api.callsTo('GET core /my_permissions')).toHaveLength(1);
            expect(api.callsTo('GET discounts /integrations')).toHaveLength(1);

            api.fallback(mockEverything);
            await list(page).getByRole('link', { name: 'Add codes to Flixbus' }).click();
            await expect(page).toHaveURL(/\/discounts\/integrations\/1\/add-codes$/);
        });
    });

    test('a member without the permission gets no way to create an integration', async ({ page, api }) => {
        api.json('GET discounts /integrations', ok([FLIXBUS]));

        await page.goto('/discounts/integrations');

        await expect(tableRows(table(page))).toHaveCount(1);
        await expect(list(page).getByRole('link', { name: 'Create integration' })).toHaveCount(0);
    });

    test('a member with a manage:discounts permission gets the way to create an integration', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:manage:discounts'));
        api.json('GET discounts /integrations', ok([FLIXBUS]));

        await page.goto('/discounts/integrations');

        await expect(list(page).getByRole('link', { name: 'Create integration' })).toBeVisible();
    });

    test('says so when there are no integrations', async ({ page, api }) => {
        api.json('GET discounts /integrations', ok([]));

        await page.goto('/discounts/integrations');

        await expect(list(page)).not.toHaveAttribute('aria-busy');
        await expectEmptyTable(table(page));
    });

    test('says so when the integrations cannot be loaded, and stops loading', async ({ page, api }) => {
        api.on('GET discounts /integrations', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/discounts/integrations');

        await expect(toast(page, 'Could not fetch integrations list: Database is down')).toBeVisible();
        await expect(list(page)).not.toHaveAttribute('aria-busy');
    });

    test('is busy until the integrations are in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET discounts /integrations', async () => { await held; return { json: ok([FLIXBUS]) }; });

        await page.goto('/discounts/integrations');

        await expect(list(page)).toHaveAttribute('aria-busy', 'true');
        release();
        await expect(list(page)).not.toHaveAttribute('aria-busy');
        await expect(tableRows(table(page))).toHaveCount(1);
    });
});
