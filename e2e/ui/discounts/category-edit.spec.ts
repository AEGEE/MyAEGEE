// Creating and editing a discount category (/discounts/categories/new,
// /discounts/categories/:id/edit): its name and its discounts, each with a name, an icon and a
// short and a long description (markdown). The discounts service decides who may save.
import type { Locator, Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { discount, discountCategory, type Discount } from '../support/factories/discounts.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { pageFadedIn } from '../support/discounts-helpers.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const form = (page: Page, name: 'Create category' | 'Edit category') => page.getByRole('form', { name });
// The category's own name comes before the names of its discounts.
const categoryName = (page: Page) => page.getByLabel('Name', { exact: true }).first();

const fillDiscount = async (group: Locator, { name, icon, shortDescription, longDescription }: Discount): Promise<void> => {
    await group.getByLabel('Name', { exact: true }).fill(name);
    await group.getByLabel('Icon', { exact: true }).fill(icon);
    await group.getByLabel('Description (short)').fill(shortDescription);
    await group.getByLabel('Description (long)').fill(longDescription);
};

const TRAVEL = discountCategory({
    id: 5,
    name: 'Travel',
    discounts: [discount({ name: 'Flixbus', icon: 'bus', shortDescription: '10% off', longDescription: 'Book on **flixbus.com**.' })]
});

test.describe('discount category form', () => {
    test('creating a category with two discounts sends them and goes back to the list', async ({ page, api }) => {
        api.json('POST discounts /categories', ok(discountCategory({ id: 9, name: 'Travel' })));

        await page.goto('/discounts/categories/new');

        const create = form(page, 'Create category');
        await expect(page.getByRole('heading', { name: 'Create category' })).toBeVisible();
        await expect(create.getByText('You didn\'t add any discounts.')).toBeVisible();
        await expect(categoryName(page)).toHaveValue('');

        // Adding a discount doesn't try to send the form: the button keeps the focus, it doesn't
        // move to the first empty field.
        const add = create.getByRole('button', { name: 'Add new discount' });
        await add.click();
        await expect(add).toBeFocused();
        await expect(create.getByText('You didn\'t add any discounts.')).toBeHidden();
        const first = create.getByRole('group', { name: 'Discount 1' });
        await expect(first.getByLabel('Icon', { exact: true })).toHaveAccessibleDescription(/without the fa- prefix/);
        await categoryName(page).fill('Travel');
        await fillDiscount(first, { name: 'Wrong', icon: 'bed', shortDescription: 'x', longDescription: 'x' });
        await add.click();
        await fillDiscount(create.getByRole('group', { name: 'Discount 2' }), { name: 'Flixbus', icon: 'bus', shortDescription: '10% off', longDescription: 'Book on **flixbus.com**.' });

        // Deleting a discount doesn't send the form either, also when everything is filled in.
        await first.getByRole('button', { name: 'Delete discount' }).click();
        await expect(create.getByRole('group')).toHaveCount(1);
        await expect(first.getByLabel('Name', { exact: true })).toHaveValue('Flixbus');

        await add.click();
        await fillDiscount(create.getByRole('group', { name: 'Discount 2' }), { name: 'Hostelworld', icon: 'bed', shortDescription: 'No fee', longDescription: 'In *every* hostel.' });
        await expect(page).toHaveURL(/\/discounts\/categories\/new$/);
        expect(api.callsTo('POST discounts /categories')).toEqual([]);

        api.fallback(mockEverything);
        await create.getByRole('button', { name: 'Save category' }).click();

        await expect(toast(page, 'Category is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/?$/);
        expect(api.callsTo('POST discounts /categories').map((call) => call.body)).toEqual([{
            name: 'Travel',
            discounts: [
                { name: 'Flixbus', icon: 'bus', shortDescription: '10% off', longDescription: 'Book on **flixbus.com**.' },
                { name: 'Hostelworld', icon: 'bed', shortDescription: 'No fee', longDescription: 'In *every* hostel.' }
            ]
        }]);
        expect(api.callsTo('GET discounts /categories/:id')).toEqual([]);
    });

    test('editing loads the category and saves it with its changes', async ({ page, api }) => {
        api.json('GET discounts /categories/:id', ok(TRAVEL));
        api.json('PUT discounts /categories/:id', ok({ ...TRAVEL, name: 'Travel and trains' }));

        await page.goto('/discounts/categories/5/edit');

        const edit = form(page, 'Edit category');
        await expect(page.getByRole('heading', { name: 'Edit category' })).toBeVisible();
        await expect(categoryName(page)).toHaveValue('Travel');
        const flixbus = edit.getByRole('group', { name: 'Discount 1' });
        await expect(flixbus.getByLabel('Name', { exact: true })).toHaveValue('Flixbus');
        await expect(flixbus.getByLabel('Icon', { exact: true })).toHaveValue('bus');
        await expect(flixbus.getByLabel('Description (short)')).toHaveValue('10% off');
        await expect(flixbus.getByLabel('Description (long)')).toHaveValue('Book on **flixbus.com**.');
        await expect(edit.getByRole('group')).toHaveCount(1);

        await categoryName(page).fill('Travel and trains');
        await flixbus.getByLabel('Description (short)').fill('15% off');
        api.fallback(mockEverything);
        await edit.getByRole('button', { name: 'Save category' }).click();

        await expect(toast(page, 'Category is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/?$/);
        expect(api.callsTo('GET discounts /categories/:id').map((call) => call.params)).toEqual([{ id: '5' }]);
        // The page sends the category as it loaded it, with the changes.
        expect(api.callsTo('PUT discounts /categories/:id').map((call) => [call.params, call.body])).toEqual([[{ id: '5' }, {
            ...TRAVEL,
            name: 'Travel and trains',
            discounts: [{ ...TRAVEL.discounts[0], shortDescription: '15% off' }]
        }]]);
    });

    test('a category that doesn\'t exist goes back to the list with a toast', async ({ page, api }) => {
        api.on('GET discounts /categories/:id', { status: 404, json: notFound('The category is not found.') });
        api.fallback(mockEverything);

        await page.goto('/discounts/categories/404/edit');

        await expect(toast(page, 'Category is not found')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/?$/);
    });

    test('a category that can\'t be loaded goes back to the list with the reason', async ({ page, api }) => {
        api.on('GET discounts /categories/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        api.fallback(mockEverything);

        await page.goto('/discounts/categories/5/edit');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/?$/);
    });

    test('a category without discounts is not sent', async ({ page }) => {
        await page.goto('/discounts/categories/new');

        await categoryName(page).fill('Empty');
        await form(page, 'Create category').getByRole('button', { name: 'Save category' }).click();

        await expect(toast(page, 'Please add at least 1 discount for this category.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/new$/);
    });

    test('shows the service\'s validation errors of the name and of the discounts', async ({ page, api }) => {
        api.json('GET discounts /categories/:id', ok(TRAVEL));
        api.on('PUT discounts /categories/:id', {
            status: 422,
            json: validationError({ name: ['Name should be set.'], discounts: ['"[0].icon" is not allowed to be empty'] })
        });

        await page.goto('/discounts/categories/5/edit');
        const edit = form(page, 'Edit category');
        await expect(categoryName(page)).toHaveValue('Travel');
        await categoryName(page).fill(' ');
        await edit.getByRole('group', { name: 'Discount 1' }).getByLabel('Icon', { exact: true }).fill(' ');
        await edit.getByRole('button', { name: 'Save category' }).click();

        await expect(toast(page, 'Some of the category data is invalid.')).toBeVisible();
        await expect(edit.getByText('Name should be set.')).toBeVisible();
        await expect(edit.getByText('"[0].icon" is not allowed to be empty')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/5\/edit$/);
        await expect(edit.getByRole('button', { name: 'Save category' })).toBeEnabled();
    });

    test('a refused save shows the service\'s reason', async ({ page, api }) => {
        api.json('GET discounts /categories/:id', ok(TRAVEL));
        api.on('PUT discounts /categories/:id', { status: 403, json: forbidden('You are not allowed to update category.') });

        await page.goto('/discounts/categories/5/edit');
        await expect(categoryName(page)).toHaveValue('Travel');
        await form(page, 'Edit category').getByRole('button', { name: 'Save category' }).click();

        await expect(toast(page, 'Could not save category: You are not allowed to update category.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/categories\/5\/edit$/);
    });

    test('the long description has a markdown preview, and help on markdown', async ({ page }) => {
        await page.goto('/discounts/categories/new');
        const create = form(page, 'Create category');
        await create.getByRole('button', { name: 'Add new discount' }).click();
        const first = create.getByRole('group', { name: 'Discount 1' });

        await first.getByLabel('Description (long)').fill('Book on **flixbus.com**, *any* day. [Rules](https://www.flixbus.com/rules)');

        const preview = first.getByRole('region', { name: 'Preview' });
        await expect(preview.getByRole('strong')).toHaveText('flixbus.com');
        await expect(preview.getByRole('emphasis')).toHaveText('any');
        await expect(preview.getByRole('link', { name: 'Rules' })).toHaveAttribute('href', 'https://www.flixbus.com/rules');

        await first.getByRole('button', { name: 'More information' }).focus();
        await expect(page.getByRole('tooltip')).toContainText('The input field above accepts Markdown');
    });

    test('the save button is off while the category is being saved', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET discounts /categories/:id', ok(TRAVEL));
        api.on('PUT discounts /categories/:id', async () => { await held; return { status: 403, json: forbidden('You are not allowed to update category.') }; });

        await page.goto('/discounts/categories/5/edit');
        const save = form(page, 'Edit category').getByRole('button', { name: 'Save category' });
        await expect(categoryName(page)).toHaveValue('Travel');
        await save.click();

        await expect(save).toBeDisabled();
        release();
        await expect(toast(page, 'Could not save category: You are not allowed to update category.')).toBeVisible();
        await expect(save).toBeEnabled();
    });

    test('while the category loads, only the form is busy and the rest of the page can be used', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET discounts /categories/:id', async () => { await held; return { json: ok(TRAVEL) }; });

        await page.goto('/discounts/categories/5/edit');

        const edit = form(page, 'Edit category');
        await expect(edit).toHaveAttribute('aria-busy', 'true');
        await pageFadedIn(page);
        // Nothing covers the rest of the page, such as the bar above the form with the page's name.
        await page.getByRole('heading', { name: 'Edit single category' }).click({ trial: true, timeout: 5000 });
        release();
        await expect(edit).not.toHaveAttribute('aria-busy');
        await expect(categoryName(page)).toHaveValue('Travel');
    });
});
