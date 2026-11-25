// A permission's page (/permissions/:id): its code, description, filters and the circles it is
// attached to, and for those who may, ways to its members, its edit page and to delete it.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, okList } from '../support/factories/base.ts';
import { circle, permission } from '../support/factories/core.ts';
import { permissionDetail, type PermissionDetail } from '../support/factories/core-circles.ts';
import { dialog, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const fact = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');
const deleteButton = (page: Page) => page.getByRole('button', { name: 'Delete permission', exact: true });

const viewMember = (overrides: Partial<PermissionDetail> = {}) => permissionDetail('global:view:member', { id: 31, description: 'View all members', ...overrides });

test.describe('permission page', () => {
    test('shows the permission, its filters and the circles it is attached to', async ({ page, api }) => {
        api.json('GET core /permissions/:id', ok(viewMember({
            filters: ['first_name', 'last_name'],
            circles: [circle({ id: 2, name: 'General board circle' }), circle({ id: 11, name: 'Network Commission' })]
        })));

        await page.goto('/permissions/31');

        await expect(page.getByRole('heading', { name: 'global:view:member' })).toBeVisible();
        await expect(fact(page, 'Code')).toHaveText('global:view:member');
        await expect(fact(page, 'Description')).toHaveText('View all members');
        await expect(fact(page, 'Filters').getByRole('listitem')).toHaveText(['first_name', 'last_name']);
        await expect(fact(page, 'Directly attached to:').getByRole('link')).toHaveText(['General board circle', 'Network Commission']);
        await expect(fact(page, 'Directly attached to:').getByRole('link', { name: 'Network Commission' })).toHaveAttribute('href', '/circles/11');
        await expect.poll(() => api.callsTo('GET core /permissions/:id').map((call) => call.params.id)).toEqual(['31']);
    });

    test('says when the permission has no filters and is attached to no circle', async ({ page, api }) => {
        // A field that permissions no longer have.
        api.json('GET core /permissions/:id', ok({ ...viewMember(), always_assigned: true }));

        await page.goto('/permissions/31');

        await expect(fact(page, 'Filters')).toHaveText('Not set');
        await expect(fact(page, 'Directly attached to:')).toHaveText('Not attached');
        await expect(page.getByRole('rowheader', { name: 'Always assigned?' })).toHaveCount(0);
    });

    test('managers of permissions get a way to its members, its edit page and to delete it', async ({ page, api, myPermissions }) => {
        myPermissions.push(...['global:update:permission', 'global:delete:permission', 'global:view:member'].map(permission));
        api.json('GET core /permissions/:id', ok(viewMember()));

        await page.goto('/permissions/31');

        await expect(page.getByRole('link', { name: 'View members' })).toHaveAttribute('href', '/permissions/31/members');
        await expect(page.getByRole('link', { name: 'Edit permission' })).toHaveAttribute('href', '/permissions/31/edit');
        await expect(deleteButton(page)).toBeVisible();
    });

    test('a member who may do nothing with permissions only sees it', async ({ page, api }) => {
        api.json('GET core /permissions/:id', ok(viewMember()));

        await page.goto('/permissions/31');

        await expect(fact(page, 'Code')).toHaveText('global:view:member');
        await expect(page.getByRole('link', { name: 'View members' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Edit permission' })).toHaveCount(0);
        await expect(deleteButton(page)).toHaveCount(0);
    });

    test('says so when the permission does not exist', async ({ page, api }) => {
        api.on('GET core /permissions/:id', { status: 404, json: notFound('Permission is not found.') });
        api.json('GET core /permissions', okList([]));

        await page.goto('/permissions/31');

        await expect(toast(page, 'Permission is not found')).toBeVisible();
        await expect(page).toHaveURL('/permissions');
    });

    test('says why the permission could not be loaded', async ({ page, api }) => {
        api.on('GET core /permissions/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.json('GET core /permissions', okList([]));

        await page.goto('/permissions/31');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/permissions');
    });

    test.describe('deleting the permission', () => {
        test.beforeEach(({ myPermissions }) => {
            myPermissions.push(permission('global:delete:permission'));
        });

        test('asks first, then deletes it and goes back to the list', async ({ page, api }) => {
            api.json('GET core /permissions/:id', ok(viewMember()));
            api.json('DELETE core /permissions/:id', { success: true, message: 'Permission is deleted.' });
            api.json('GET core /permissions', okList([]));
            await page.goto('/permissions/31');

            await deleteButton(page).click();
            const confirm = dialog(page, 'Deleting permission');
            await expect(confirm).toContainText('Are you sure you want to delete this permission? This action cannot be undone.');
            await confirm.getByRole('button', { name: 'Delete permission' }).click();

            await expect(toast(page, 'Permission is deleted.')).toBeVisible();
            await expect(page).toHaveURL('/permissions');
            await expect.poll(() => api.callsTo('DELETE core /permissions/:id').map((call) => call.params.id)).toEqual(['31']);
        });

        test('does nothing when the member changes their mind', async ({ page, api }) => {
            api.json('GET core /permissions/:id', ok(viewMember()));
            await page.goto('/permissions/31');

            await deleteButton(page).click();
            await dialog(page, 'Deleting permission').getByRole('button', { name: 'Cancel' }).click();

            await expect(dialog(page, 'Deleting permission')).toBeHidden();
            await expect(page).toHaveURL('/permissions/31');
            expect(api.callsTo('DELETE core /permissions/:id')).toHaveLength(0);
        });

        test('says why the permission could not be deleted', async ({ page, api }) => {
            api.json('GET core /permissions/:id', ok(viewMember()));
            api.on('DELETE core /permissions/:id', { status: 403, json: forbidden('Permission global:delete:permission is required, but not present.') });
            await page.goto('/permissions/31');

            await deleteButton(page).click();
            await dialog(page, 'Deleting permission').getByRole('button', { name: 'Delete permission' }).click();

            await expect(toast(page, 'Could not delete permission: Permission global:delete:permission is required, but not present.')).toBeVisible();
            await expect(page).toHaveURL('/permissions/31');
        });
    });
});
