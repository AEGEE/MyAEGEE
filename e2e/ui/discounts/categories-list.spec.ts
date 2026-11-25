// The list of discount categories (/discounts/categories/), where discounts managers create,
// edit and delete the categories the discounts page shows. Members only; the discounts service
// lets only holders of a `manage:discounts` permission change them.
import type { Page } from '@playwright/test';

import { forbidden, ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { discount, discountCategory } from '../support/factories/discounts.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { cellOf, dialog, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const TRAVEL = discountCategory({ id: 1, name: 'Travel', discounts: [discount({ name: 'Flixbus' }), discount({ name: 'Hostelworld', icon: 'bed' })] });
const FOOD = discountCategory({ id: 2, name: 'Food', discounts: [discount({ name: 'Pizza Place', icon: 'utensils' })] });

const list = (page: Page) => page.getByRole('article', { name: 'Discounts categories list' });
const table = (page: Page) => list(page).getByRole('table');

test.describe('discount categories list', () => {
    test.describe('for a discounts manager', () => {
        test.use({ session: 'superadmin' });

        test('lists every category with its discounts, and the ways to create and edit them', async ({ page, api }) => {
            api.json('GET discounts /categories', ok([TRAVEL, FOOD]));

            await page.goto('/discounts/categories/');

            await expect(list(page).getByRole('link', { name: 'Create category' })).toHaveAttribute('href', '/discounts/categories/new');
            const rows = tableRows(table(page));
            await expect(rows).toHaveCount(2);
            await expect(await cellOf(table(page), rows.first(), 'Name')).toHaveText('Travel');
            await expect((await cellOf(table(page), rows.first(), 'Discounts')).getByRole('listitem')).toHaveText(['Flixbus', 'Hostelworld']);
            await expect((await cellOf(table(page), rows.nth(1), 'Discounts')).getByRole('listitem')).toHaveText(['Pizza Place']);
            await expect(list(page).getByRole('link', { name: 'Edit category Travel' })).toHaveAttribute('href', '/discounts/categories/1/edit');
            await expect(list(page).getByRole('link', { name: 'Edit category Food' })).toHaveAttribute('href', '/discounts/categories/2/edit');
            await expect(list(page).getByRole('button', { name: 'Delete category Food' })).toBeVisible();
            // The app asked for the permissions once, when it started; the page didn't ask again.
            expect(api.callsTo('GET core /my_permissions')).toHaveLength(1);
            expect(api.callsTo('GET discounts /categories')).toHaveLength(1);

            api.fallback(mockEverything);
            await list(page).getByRole('link', { name: 'Create category' }).click();
            await expect(page).toHaveURL(/\/discounts\/categories\/new$/);
        });

        test('deleting a category asks first: Cancel keeps it, confirming removes it with a toast', async ({ page, api }) => {
            api.json('GET discounts /categories', ok([TRAVEL, FOOD]));
            api.json('DELETE discounts /categories/:id', ok(FOOD));

            await page.goto('/discounts/categories/');

            await list(page).getByRole('button', { name: 'Delete category Food' }).click();
            const confirm = dialog(page, 'Delete a category');
            await expect(confirm).toContainText('Are you sure you want to delete this category? This action cannot be undone.');
            await confirm.getByRole('button', { name: 'Cancel' }).click();
            await expect(confirm).toBeHidden();
            await expect(tableRows(table(page))).toHaveCount(2);
            expect(api.callsTo('DELETE discounts /categories/:id')).toEqual([]);

            await list(page).getByRole('button', { name: 'Delete category Food' }).click();
            await dialog(page, 'Delete a category').getByRole('button', { name: 'Delete category' }).click();

            await expect(toast(page, 'Category is deleted.')).toBeVisible();
            const rows = tableRows(table(page));
            await expect(rows).toHaveCount(1);
            await expect(await cellOf(table(page), rows.first(), 'Name')).toHaveText('Travel');
            expect(api.callsTo('DELETE discounts /categories/:id').map((call) => [call.params, call.body])).toEqual([[{ id: '2' }, undefined]]);
        });

        test('a refused delete shows the service\'s reason and keeps the category', async ({ page, api }) => {
            api.json('GET discounts /categories', ok([TRAVEL, FOOD]));
            api.on('DELETE discounts /categories/:id', { status: 403, json: forbidden('You are not allowed to delete category.') });

            await page.goto('/discounts/categories/');
            await list(page).getByRole('button', { name: 'Delete category Travel' }).click();
            await dialog(page, 'Delete a category').getByRole('button', { name: 'Delete category' }).click();

            await expect(toast(page, 'Could not delete category: You are not allowed to delete category.')).toBeVisible();
            await expect(tableRows(table(page))).toHaveCount(2);
            expect(api.callsTo('DELETE discounts /categories/:id').map((call) => call.params)).toEqual([{ id: '1' }]);
        });
    });

    test('a member without the permission gets no way to create a category', async ({ page, api }) => {
        api.json('GET discounts /categories', ok([TRAVEL]));

        await page.goto('/discounts/categories/');

        await expect(tableRows(table(page))).toHaveCount(1);
        await expect(list(page).getByRole('link', { name: 'Create category' })).toHaveCount(0);
    });

    test('a member with a manage:discounts permission gets the way to create a category', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:manage:discounts'));
        api.json('GET discounts /categories', ok([TRAVEL]));

        await page.goto('/discounts/categories/');

        await expect(list(page).getByRole('link', { name: 'Create category' })).toBeVisible();
    });

    test('says so when there are no categories', async ({ page, api }) => {
        api.json('GET discounts /categories', ok([]));

        await page.goto('/discounts/categories/');

        await expect(list(page)).not.toHaveAttribute('aria-busy');
        await expectEmptyTable(table(page));
    });

    test('says so when the categories cannot be loaded, and stops loading', async ({ page, api }) => {
        api.on('GET discounts /categories', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/discounts/categories/');

        await expect(toast(page, 'Could not fetch categories list: Database is down')).toBeVisible();
        await expect(list(page)).not.toHaveAttribute('aria-busy');
    });

    test('is busy until the categories are in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET discounts /categories', async () => { await held; return { json: ok([TRAVEL]) }; });

        await page.goto('/discounts/categories/');

        await expect(list(page)).toHaveAttribute('aria-busy', 'true');
        release();
        await expect(list(page)).not.toHaveAttribute('aria-busy');
        await expect(tableRows(table(page))).toHaveCount(1);
    });
});
