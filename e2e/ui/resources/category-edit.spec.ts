// Adding and editing a section of the resources page (/resources/categories/new,
// /resources/categories/:id/edit): its name and its colour. Any member can open the form; core
// decides on saving whether they may.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { resourceCategory, resourceLink } from '../support/factories/static.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const form = (page: Page, name: 'Add section' | 'Edit section') => page.getByRole('form', { name });
const colour = (page: Page, name: string) => page.getByRole('group', { name: 'Colour' }).getByRole('radio', { name, exact: true });

const FINANCIAL = resourceCategory({
    id: 2,
    name: 'Financial',
    theme: 'yellow',
    position: 1,
    links: [resourceLink({ category_id: 2, title: 'Financial guidelines' })]
});

test.describe('resources section form', () => {
    test('adding a section sends its name and colour and goes back to managing the page', async ({ page, api }) => {
        api.json('POST core /resources/categories', ok(resourceCategory({ id: 9, name: 'Templates', theme: 'green', links: undefined })));
        api.json('GET core /resources', ok([FINANCIAL, resourceCategory({ id: 9, name: 'Templates', theme: 'green', links: [] })]));

        await page.goto('/resources/categories/new');

        const add = form(page, 'Add section');
        await expect(page.getByRole('heading', { name: 'Add section', exact: true })).toBeVisible();
        await expect(add.getByLabel('Name')).toHaveValue('');
        await expect(page.getByRole('group', { name: 'Colour' }).getByRole('radio')).toHaveCount(7);
        for (const name of ['Blue', 'Dark blue', 'Purple', 'Red', 'Dark grey', 'Yellow', 'Light green']) {
            await expect(colour(page, name)).toBeVisible();
        }
        await expect(colour(page, 'Blue')).toBeChecked();

        await add.getByLabel('Name').fill('Templates');
        await colour(page, 'Light green').check();
        await add.getByRole('button', { name: 'Save section' }).click();

        await expect(toast(page, 'Section is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('region', { name: 'Templates', exact: true })).toBeVisible();
        expect(api.callsTo('POST core /resources/categories').map((call) => call.body)).toEqual([{ name: 'Templates', theme: 'green' }]);
    });

    test('editing loads the section and saves the changes', async ({ page, api }) => {
        api.json('GET core /resources/categories/:id', ok(FINANCIAL));
        api.json('PUT core /resources/categories/:id', ok({ ...FINANCIAL, name: 'Money', theme: 'red', links: undefined }));
        api.json('GET core /resources', ok([{ ...FINANCIAL, name: 'Money', theme: 'red' }]));

        await page.goto('/resources/categories/2/edit');

        const edit = form(page, 'Edit section');
        await expect(page.getByRole('heading', { name: 'Edit section', exact: true })).toBeVisible();
        await expect(edit.getByLabel('Name')).toHaveValue('Financial');
        await expect(colour(page, 'Yellow')).toBeChecked();

        await edit.getByLabel('Name').fill('Money');
        await colour(page, 'Red').check();
        await edit.getByRole('button', { name: 'Save section' }).click();

        await expect(toast(page, 'Section is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('region', { name: 'Money', exact: true })).toBeVisible();
        expect(api.callsTo('GET core /resources/categories/:id').map((call) => call.params)).toEqual([{ id: '2' }]);
        // Only the name and the colour: the links and the place of the section stay as they are.
        expect(api.callsTo('PUT core /resources/categories/:id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '2' }, { name: 'Money', theme: 'red' }]]);
    });

    test('a section that doesn\'t exist goes back to managing the page with the reason', async ({ page, api }) => {
        api.on('GET core /resources/categories/:id', { status: 404, json: notFound('Section is not found.') });
        api.json('GET core /resources', ok([FINANCIAL]));

        await page.goto('/resources/categories/404/edit');

        await expect(toast(page, 'Could not load the section: Section is not found.')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
    });

    test('shows core\'s messages under their fields, and clears them on the next try', async ({ page, api }) => {
        api.json('GET core /resources/categories/:id', ok(FINANCIAL));
        let attempts = 0;
        api.on('PUT core /resources/categories/:id', () => {
            attempts += 1;
            return attempts === 1
                ? { status: 422, json: validationError({ name: ['Name should be set.'], theme: ['Theme should be one of: blue, blue-dark, purple, red, grey, yellow, green.'] }) }
                : { status: 403, json: forbidden('Permission global:manage:resources is required, but not present.') };
        });

        await page.goto('/resources/categories/2/edit');
        const edit = form(page, 'Edit section');
        await expect(edit.getByLabel('Name')).toHaveValue('Financial');
        await expect(edit.getByLabel('Name')).toHaveAccessibleDescription('');
        // Core trims the name, so a name of spaces passes the browser but not core.
        await edit.getByLabel('Name').fill('   ');
        await edit.getByRole('button', { name: 'Save section' }).click();

        await expect(toast(page, 'Some of the section data is invalid.')).toBeVisible();
        await expect(edit.getByLabel('Name')).toHaveAccessibleDescription('Name should be set.');
        await expect(page.getByRole('group', { name: 'Colour' }))
            .toHaveAccessibleDescription('Theme should be one of: blue, blue-dark, purple, red, grey, yellow, green.');
        await expect(page).toHaveURL(/\/resources\/categories\/2\/edit$/);

        await edit.getByLabel('Name').fill('Money');
        await edit.getByRole('button', { name: 'Save section' }).click();

        await expect(toast(page, 'Could not save the section: Permission global:manage:resources is required, but not present.')).toBeVisible();
        await expect(edit.getByText('Name should be set.')).toHaveCount(0);
        await expect(edit.getByText(/^Theme should be one of/)).toHaveCount(0);
        await expect(page).toHaveURL(/\/resources\/categories\/2\/edit$/);
        expect(api.callsTo('PUT core /resources/categories/:id').map((call) => call.body))
            .toEqual([{ name: '   ', theme: 'yellow' }, { name: 'Money', theme: 'yellow' }]);
    });

    test('the browser asks for a name, and limits it to what core takes', async ({ page }) => {
        await page.goto('/resources/categories/new');
        const add = form(page, 'Add section');

        await expect(add.getByLabel('Name')).toHaveAttribute('maxlength', '100');
        await add.getByRole('button', { name: 'Save section' }).click();

        await expect(add.getByLabel('Name')).toBeFocused();
        expect(await add.getByLabel('Name').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        await expect(page).toHaveURL(/\/resources\/categories\/new$/);
    });

    test('the save button is off while the section is saved', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('POST core /resources/categories', async () => {
            await held;
            return { status: 403, json: forbidden('Permission global:manage:resources is required, but not present.') };
        });

        await page.goto('/resources/categories/new');
        const add = form(page, 'Add section');
        const save = add.getByRole('button', { name: 'Save section' });
        await add.getByLabel('Name').fill('Templates');
        await save.click();

        await expect(save).toBeDisabled();
        release();
        await expect(toast(page, 'Could not save the section: Permission global:manage:resources is required, but not present.')).toBeVisible();
        await expect(save).toBeEnabled();
        expect(api.callsTo('POST core /resources/categories').map((call) => call.body)).toEqual([{ name: 'Templates', theme: 'blue' }]);
    });

    test('is busy until the section is in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET core /resources/categories/:id', async () => { await held; return { json: ok(FINANCIAL) }; });

        await page.goto('/resources/categories/2/edit');

        const edit = form(page, 'Edit section');
        await expect(edit).toHaveAttribute('aria-busy', 'true');
        release();
        await expect(edit).not.toHaveAttribute('aria-busy');
        await expect(edit.getByLabel('Name')).toHaveValue('Financial');
    });

    test('Cancel goes back to managing the page without saving', async ({ page, api }) => {
        api.json('GET core /resources/categories/:id', ok(FINANCIAL));
        api.json('GET core /resources', ok([FINANCIAL]));

        await page.goto('/resources/categories/2/edit');
        const edit = form(page, 'Edit section');
        await expect(edit.getByLabel('Name')).toHaveValue('Financial');
        await edit.getByLabel('Name').fill('Money');
        await edit.getByRole('link', { name: 'Cancel' }).click();

        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('region', { name: 'Financial', exact: true })).toBeVisible();
    });
});
