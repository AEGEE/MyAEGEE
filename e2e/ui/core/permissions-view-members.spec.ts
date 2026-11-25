// The members who have a permission (/permissions/:id/members), for global:view:member.
import type { Page } from '@playwright/test';

import { forbidden, ok, okList } from '../support/factories/base.ts';
import { permissionDetail, permissionHolder } from '../support/factories/core-circles.ts';
import { expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const table = (page: Page) => page.getByRole('table');
const VIEW_MEMBER = permissionDetail('global:view:member', { id: 31 });

test.describe('members who have a permission', () => {
    test('lists them with links to their profiles', async ({ page, api }) => {
        api.json('GET core /permissions/:id', ok(VIEW_MEMBER));
        api.json('GET core /permissions/:id/members', okList([
            permissionHolder({ id: 21, username: 'alex.member', first_name: 'Alex', last_name: 'Member' }),
            permissionHolder({ id: 22, username: '', first_name: 'Una', last_name: 'Named' })
        ]));

        await page.goto('/permissions/31/members');

        await expect(page.getByRole('heading', { name: 'Members who have the permission global:view:member' })).toBeVisible();
        await expect(table(page).getByRole('link', { name: 'Alex Member' })).toHaveAttribute('href', '/members/alex.member');
        // Without a username the link goes to the id.
        await expect(table(page).getByRole('link', { name: 'Una Named' })).toHaveAttribute('href', '/members/22');
        await expect.poll(() => api.callsTo('GET core /permissions/:id').map((call) => call.params.id)).toEqual(['31']);
        await expect.poll(() => api.callsTo('GET core /permissions/:id/members').map((call) => [call.params.id, Object.fromEntries(call.query)])).toEqual([['31', {}]]);
    });

    test('says so when nobody has the permission', async ({ page, api }) => {
        api.json('GET core /permissions/:id', ok(VIEW_MEMBER));
        api.json('GET core /permissions/:id/members', okList([]));

        await page.goto('/permissions/31/members');

        await expect.poll(() => api.callsTo('GET core /permissions/:id/members').length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('sorts them by name', async ({ page, api, layout }) => {
        api.json('GET core /permissions/:id', ok(VIEW_MEMBER));
        api.json('GET core /permissions/:id/members', okList([
            permissionHolder({ first_name: 'Bea', last_name: 'Board' }),
            permissionHolder({ first_name: 'Alex', last_name: 'Member' }),
            permissionHolder({ first_name: 'Cleo', last_name: 'Circle' })
        ]));
        await page.goto('/permissions/31/members');
        await expect(tableRows(table(page))).toHaveText([/Bea Board/, /Alex Member/, /Cleo Circle/]);

        // Ascending first, then the other way round.
        await sortBy(table(page), 'Name and surname', layout, 'desc');

        await expect(tableRows(table(page))).toHaveText([/Cleo Circle/, /Bea Board/, /Alex Member/]);
    });

    test('says why the members could not be loaded and goes back to the permission', async ({ page, api }) => {
        api.json('GET core /permissions/:id', ok(VIEW_MEMBER));
        api.on('GET core /permissions/:id/members', { status: 403, json: forbidden('Permission global:view:member is required, but not present.') });

        await page.goto('/permissions/31/members');

        await expect(toast(page, 'Could not fetch members: Permission global:view:member is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/permissions/31');
        await expect(page.getByRole('heading', { name: 'global:view:member' })).toBeVisible();
    });

    test('goes back to the permission when it could not be loaded', async ({ page, api }) => {
        let asked = 0;
        // The page of the permission asks again, and then gets it.
        api.on('GET core /permissions/:id', () => (asked++ === 0
            ? { status: 500, json: { success: false, message: 'Something went wrong on the server.' } }
            : { json: ok(VIEW_MEMBER) }));

        await page.goto('/permissions/31/members');

        await expect(toast(page, 'Could not fetch members: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/permissions/31');
        await expect(page.getByRole('heading', { name: 'global:view:member' })).toBeVisible();
        expect(api.callsTo('GET core /permissions/:id/members')).toHaveLength(0);
    });
});
