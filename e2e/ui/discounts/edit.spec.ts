// Creating and editing a discount integration (/discounts/integrations/new,
// /discounts/integrations/:id/edit): a partner with its name, description (markdown), code
// and the number of codes a member may claim per day, month or year. The discounts service
// decides who may save.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { integration } from '../support/factories/discounts.ts';
import { pageFadedIn } from '../support/discounts-helpers.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const form = (page: Page, name: 'Create integration' | 'Edit integration') => page.getByRole('form', { name });

const FLIXBUS = integration({ id: 7, name: 'Flixbus', code: 'flixbus', description: 'Use the code on **flixbus.com**.', quota_amount: 2, quota_period: 'month' });

test.describe('discount integration form', () => {
    test('creating an integration sends its fields and quota, and goes back to the list', async ({ page, api }) => {
        api.json('POST discounts /integrations', ok(integration({ id: 9 })));

        await page.goto('/discounts/integrations/new');

        const create = form(page, 'Create integration');
        await expect(page.getByRole('heading', { name: 'Create integration' })).toBeVisible();
        await expect(create.getByLabel('Codes per period')).toHaveValue('1');
        await expect(create.getByLabel('Period', { exact: true })).toHaveValue('month');
        await create.getByLabel('Name', { exact: true }).fill('Hostelworld');
        await create.getByLabel('Description').fill('No booking fee in *every* hostel.');
        await create.getByLabel('Code', { exact: true }).fill('hostelworld');
        await create.getByLabel('Codes per period').fill('3');
        await create.getByLabel('Period', { exact: true }).selectOption({ label: 'Year' });
        api.fallback(mockEverything);
        await create.getByRole('button', { name: 'Save integration' }).click();

        await expect(toast(page, 'Integration is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
        expect(api.callsTo('POST discounts /integrations').map((call) => call.body)).toEqual([{
            id: null,
            name: 'Hostelworld',
            description: 'No booking fee in *every* hostel.',
            code: 'hostelworld',
            quota_amount: 3,
            quota_period: 'year'
        }]);
        expect(api.callsTo('GET discounts /integrations/:id')).toEqual([]);
    });

    test('editing loads the integration and saves it with its changes', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.json('PUT discounts /integrations/:id', ok({ ...FLIXBUS, quota_amount: 4 }));

        await page.goto('/discounts/integrations/7/edit');

        const edit = form(page, 'Edit integration');
        await expect(page.getByRole('heading', { name: 'Edit integration' })).toBeVisible();
        await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('Flixbus');
        await expect(edit.getByLabel('Description')).toHaveValue('Use the code on **flixbus.com**.');
        await expect(edit.getByLabel('Code', { exact: true })).toHaveValue('flixbus');
        await expect(edit.getByLabel('Codes per period')).toHaveValue('2');
        await expect(edit.getByLabel('Period', { exact: true })).toHaveValue('month');

        await edit.getByLabel('Codes per period').fill('4');
        api.fallback(mockEverything);
        await edit.getByRole('button', { name: 'Save integration' }).click();

        await expect(toast(page, 'Integration is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
        expect(api.callsTo('GET discounts /integrations/:id').map((call) => call.params)).toEqual([{ id: '7' }]);
        // The page sends the integration as it loaded it, with the changes.
        expect(api.callsTo('PUT discounts /integrations/:id').map((call) => [call.params, call.body])).toEqual([[{ id: '7' }, { ...FLIXBUS, quota_amount: 4 }]]);
    });

    test('the description has a markdown preview', async ({ page }) => {
        await page.goto('/discounts/integrations/new');

        const create = form(page, 'Create integration');
        await create.getByLabel('Description').fill('Book on **flixbus.com**, *any* day. [Rules](https://www.flixbus.com/rules)');

        const preview = create.getByRole('region', { name: 'Preview' });
        await expect(preview.getByRole('strong')).toHaveText('flixbus.com');
        await expect(preview.getByRole('emphasis')).toHaveText('any');
        await expect(preview.getByRole('link', { name: 'Rules' })).toHaveAttribute('href', 'https://www.flixbus.com/rules');
    });

    test('shows the service\'s validation errors under their fields', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.on('PUT discounts /integrations/:id', {
            status: 422,
            json: validationError({
                name: ['Integration name should be set.'],
                code: ['Integration code is already taken.'],
                description: ['Integration description should be at most 10000 characters long.']
            })
        });

        await page.goto('/discounts/integrations/7/edit');
        const edit = form(page, 'Edit integration');
        await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('Flixbus');
        await edit.getByLabel('Name', { exact: true }).fill(' ');
        await edit.getByRole('button', { name: 'Save integration' }).click();

        await expect(toast(page, 'Some of the integration data is invalid.')).toBeVisible();
        await expect(edit.getByText('Integration name should be set.')).toBeVisible();
        await expect(edit.getByText('Integration code is already taken.')).toBeVisible();
        await expect(edit.getByText('Integration description should be at most 10000 characters long.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations\/7\/edit$/);
    });

    test('a refused save shows the service\'s reason', async ({ page, api }) => {
        api.on('POST discounts /integrations', { status: 403, json: forbidden('You are not allowed to create integrations.') });

        await page.goto('/discounts/integrations/new');
        const create = form(page, 'Create integration');
        await create.getByLabel('Name', { exact: true }).fill('Hostelworld');
        await create.getByLabel('Description').fill('No booking fee.');
        await create.getByLabel('Code', { exact: true }).fill('hostelworld');
        await create.getByRole('button', { name: 'Save integration' }).click();

        await expect(toast(page, 'Could not save integration: You are not allowed to create integrations.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations\/new$/);
        expect(api.callsTo('POST discounts /integrations')).toHaveLength(1);
    });

    test('an integration that doesn\'t exist goes back to the list with a toast', async ({ page, api }) => {
        api.on('GET discounts /integrations/:id', { status: 404, json: notFound('The integration is not found.') });
        api.fallback(mockEverything);

        await page.goto('/discounts/integrations/404/edit');

        await expect(toast(page, 'Integration is not found')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
    });

    test('an integration that can\'t be loaded goes back to the list with the reason', async ({ page, api }) => {
        api.on('GET discounts /integrations/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        api.fallback(mockEverything);

        await page.goto('/discounts/integrations/7/edit');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
    });

    test('the save button is off while the integration is being saved', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.on('PUT discounts /integrations/:id', async () => { await held; return { status: 403, json: forbidden('You are not allowed to update integration.') }; });

        await page.goto('/discounts/integrations/7/edit');
        const save = form(page, 'Edit integration').getByRole('button', { name: 'Save integration' });
        await expect(form(page, 'Edit integration').getByLabel('Name', { exact: true })).toHaveValue('Flixbus');
        await save.click();

        await expect(save).toBeDisabled();
        release();
        await expect(toast(page, 'Could not save integration: You are not allowed to update integration.')).toBeVisible();
        await expect(save).toBeEnabled();
    });

    test('while the integration loads, only the form is busy and the rest of the page can be used', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET discounts /integrations/:id', async () => { await held; return { json: ok(FLIXBUS) }; });

        await page.goto('/discounts/integrations/7/edit');

        const edit = form(page, 'Edit integration');
        await expect(edit).toHaveAttribute('aria-busy', 'true');
        await pageFadedIn(page);
        // Nothing covers the rest of the page, such as the bar above the form with the page's name.
        await page.getByRole('heading', { name: 'Edit single integration' }).click({ trial: true, timeout: 5000 });
        release();
        await expect(edit).not.toHaveAttribute('aria-busy');
        await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('Flixbus');
    });
});
