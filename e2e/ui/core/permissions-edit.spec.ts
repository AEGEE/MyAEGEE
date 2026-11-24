// Creating a permission (/permissions/new) and editing one (/permissions/:id/edit): its scope,
// action, object, description and the fields it is limited to (filters).
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList, validationError } from '../support/factories/base.ts';
import { circle } from '../support/factories/core.ts';
import { permissionDetail, type PermissionDetail } from '../support/factories/core-circles.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const scope = (page: Page) => page.getByRole('combobox', { name: 'Scope' });
const action = (page: Page) => page.getByRole('textbox', { name: 'Action' });
const object = (page: Page) => page.getByRole('textbox', { name: 'Object' });
const description = (page: Page) => page.getByRole('textbox', { name: 'Description' });
const newFilter = (page: Page) => page.getByRole('textbox', { name: 'New filter' });
const addFilter = (page: Page) => page.getByRole('button', { name: 'Add filter' });
const removeFilter = (page: Page, filter: string) => page.getByRole('button', { name: `Remove filter ${filter}` });
const save = (page: Page) => page.getByRole('button', { name: 'Save permission' });

// The permission page, where saving leads.
const showPermissionPage = (api: ApiMock, shown: PermissionDetail) => {
    api.json('GET core /permissions/:id', ok(shown));
};

const fillRequired = async (page: Page) => {
    await action(page).fill('view');
    await object(page).fill('thing');
    await description(page).fill('View the things');
};

test.describe('creating a permission', () => {
    test('saves the permission with its filters and opens it', async ({ page, api }) => {
        const created = permissionDetail('local:view:thing', { id: 71, description: 'View the things', filters: ['name', 'description'] });
        api.json('POST core /permissions', ok(created));
        await page.goto('/permissions/new');

        await expect(page.getByRole('heading', { name: 'Create permission' })).toBeVisible();
        await scope(page).selectOption('Local');
        await fillRequired(page);
        await newFilter(page).fill('name');
        await addFilter(page).click();
        await newFilter(page).fill('description');
        await addFilter(page).click();
        await expect(newFilter(page)).toHaveValue('');
        await expect(removeFilter(page, 'name')).toBeVisible();
        showPermissionPage(api, created);
        await save(page).click();

        await expect(toast(page, 'Permission is saved.')).toBeVisible();
        await expect(page).toHaveURL('/permissions/71');
        await expect.poll(() => api.callsTo('POST core /permissions').map((call) => call.body)).toEqual([{
            scope: 'local', action: 'view', object: 'thing', description: 'View the things', filters: ['name', 'description']
        }]);
    });

    test('starts with a global permission without filters', async ({ page }) => {
        await page.goto('/permissions/new');

        await expect(scope(page)).toHaveValue('global');
        await expect(action(page)).toHaveValue('');
        await expect(object(page)).toHaveValue('');
        await expect(description(page)).toHaveValue('');
        await expect(page.getByText('No filters set.')).toBeVisible();
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        await expect(page.getByText('Always assigned?')).toHaveCount(0);
    });

    test('needs an action, an object and a description before it sends anything', async ({ page, api }) => {
        await page.goto('/permissions/new');

        await save(page).click();
        expect(await action(page).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        await action(page).fill('view');
        await save(page).click();
        expect(await object(page).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        await object(page).fill('thing');
        await save(page).click();
        expect(await description(page).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        expect(api.callsTo('POST core /permissions')).toHaveLength(0);
    });

    test('adds no empty filter', async ({ page }) => {
        await page.goto('/permissions/new');

        await expect(addFilter(page)).toBeDisabled();
        await newFilter(page).fill('name');
        await expect(addFilter(page)).toBeEnabled();
        await newFilter(page).fill('');
        await expect(addFilter(page)).toBeDisabled();
        await expect(page.getByText('No filters set.')).toBeVisible();
    });

    test('Enter in the filter field adds the filter instead of saving', async ({ page, api }) => {
        await page.goto('/permissions/new');
        await fillRequired(page);

        await newFilter(page).fill('name');
        await newFilter(page).press('Enter');

        await expect(removeFilter(page, 'name')).toBeVisible();
        await expect(newFilter(page)).toHaveValue('');
        await newFilter(page).press('Enter');
        await expect(page.getByRole('button', { name: /^Remove filter/ })).toHaveCount(1);
        expect(api.callsTo('POST core /permissions')).toHaveLength(0);
    });

    test('removing a filter only removes it', async ({ page, api }) => {
        await page.goto('/permissions/new');
        await fillRequired(page);
        await newFilter(page).fill('name');
        await addFilter(page).click();
        await newFilter(page).fill('phone');
        await addFilter(page).click();

        await removeFilter(page, 'name').click();

        await expect(removeFilter(page, 'name')).toHaveCount(0);
        await expect(removeFilter(page, 'phone')).toBeVisible();
        await removeFilter(page, 'phone').click();
        await expect(page.getByText('No filters set.')).toBeVisible();
        await expect(page).toHaveURL('/permissions/new');
        expect(api.callsTo('POST core /permissions')).toHaveLength(0);
    });

    test('shows what the server found wrong with each field', async ({ page, api }) => {
        api.on('POST core /permissions', {
            status: 422,
            json: validationError({
                scope: ['Scope should be one of "global", "local" or "join_request".'],
                action: ['Action should be set.'],
                object: ['Object should be set.'],
                description: ['Description should be set.']
            })
        });
        await page.goto('/permissions/new');

        await fillRequired(page);
        await save(page).click();

        await expect(toast(page, 'Some of the permission data is invalid.')).toBeVisible();
        await expect(page.getByText('Scope should be one of "global", "local" or "join_request".')).toBeVisible();
        await expect(page.getByText('Action should be set.')).toBeVisible();
        await expect(page.getByText('Object should be set.')).toBeVisible();
        await expect(page.getByText('Description should be set.')).toBeVisible();
        await expect(save(page)).toBeEnabled();
    });

    test('says why the permission could not be created', async ({ page, api }) => {
        api.on('POST core /permissions', { status: 403, json: forbidden('Permission global:create:permission is required, but not present.') });
        await page.goto('/permissions/new');

        await fillRequired(page);
        await save(page).click();

        await expect(toast(page, 'Could not save permission: Permission global:create:permission is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/permissions/new');
    });

    test('can not be saved twice while it is being saved', async ({ page, api }) => {
        const created = permissionDetail('global:view:thing', { id: 71 });
        api.on('POST core /permissions', { json: ok(created), delayMs: 1000 });
        showPermissionPage(api, created);
        await page.goto('/permissions/new');

        await fillRequired(page);
        await save(page).click();

        await expect(save(page)).toBeDisabled();
        await expect(page).toHaveURL('/permissions/71');
        await expect.poll(() => api.callsTo('POST core /permissions')).toHaveLength(1);
    });
});

test.describe('editing a permission', () => {
    test('shows the permission in the form and saves the changes', async ({ page, api }) => {
        const shown = permissionDetail('local:update:body', {
            id: 32, description: 'Edit the body', filters: ['description', 'phone'], circles: [circle({ name: 'General board circle' })]
        });
        api.json('GET core /permissions/:id', ok(shown));
        api.json('PUT core /permissions/:id', ok({ ...shown, description: 'Edit the details of the body' }));
        await page.goto('/permissions/32/edit');

        await expect(page.getByRole('heading', { name: 'Edit permission' })).toBeVisible();
        await expect(scope(page)).toHaveValue('local');
        await expect(action(page)).toHaveValue('update');
        await expect(object(page)).toHaveValue('body');
        await expect(description(page)).toHaveValue('Edit the body');
        await expect(removeFilter(page, 'description')).toBeVisible();
        await expect(removeFilter(page, 'phone')).toBeVisible();
        await description(page).fill('Edit the details of the body');
        await save(page).click();

        await expect(toast(page, 'Permission is saved.')).toBeVisible();
        await expect(page).toHaveURL('/permissions/32');
        // Only what can be changed, not the circles or the code made of the three parts.
        await expect.poll(() => api.callsTo('PUT core /permissions/:id').map((call) => [call.params.id, call.body])).toEqual([['32', {
            scope: 'local', action: 'update', object: 'body', description: 'Edit the details of the body', filters: ['description', 'phone']
        }]]);
    });

    test('says so when the permission does not exist', async ({ page, api }) => {
        api.on('GET core /permissions/:id', { status: 404, json: notFound('Permission is not found.') });
        api.json('GET core /permissions', okList([]));
        await page.goto('/permissions/32/edit');

        await expect(toast(page, 'Permission is not found')).toBeVisible();
        await expect(page).toHaveURL('/permissions');
    });

    test('says why the permission could not be loaded', async ({ page, api }) => {
        api.on('GET core /permissions/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.json('GET core /permissions', okList([]));
        await page.goto('/permissions/32/edit');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/permissions');
    });
});
