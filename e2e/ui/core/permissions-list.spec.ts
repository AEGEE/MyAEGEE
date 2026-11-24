// Permissions list (/permissions): every permission there is, by its code.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { ok, okList } from '../support/factories/base.ts';
import { permission, type Permission } from '../support/factories/core.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const table = (page: Page) => page.getByRole('table');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search permission' });
const loadMore = (page: Page) => page.getByRole('button', { name: 'Load more permissions' });
const queries = (api: ApiMock) => api.callsTo('GET core /permissions').map((call) => Object.fromEntries(call.query));

const described = (combined: string, description: string, overrides: Partial<Permission> = {}) => ({ ...permission(combined), description, ...overrides });
// `count` permissions numbered by their place in the list: global:action1:thing, ...
const numbered = (count: number, from = 1) => Array.from({ length: count }, (_, index) => permission(`global:action${from + index}:thing`));

test.describe('permissions list', () => {
    test('lists the permissions with their descriptions and whether they have filters', async ({ page, api }) => {
        api.json('GET core /permissions', okList([
            described('global:view:member', 'View all members', { id: 31 }),
            described('local:update:body', 'Edit the body', { id: 32, filters: ['description', 'phone'] })
        ]));

        await page.goto('/permissions');

        await expect(page.getByRole('heading', { name: 'Permissions list' })).toBeVisible();
        const view = tableRows(table(page)).filter({ hasText: 'global:view:member' });
        await expect(view.getByRole('link', { name: 'global:view:member' })).toHaveAttribute('href', '/permissions/31');
        await expect(await cellOf(table(page), view, 'Description')).toHaveText('View all members');
        await expect(await cellOf(table(page), view, 'Additional info')).toHaveText('');
        const update = tableRows(table(page)).filter({ hasText: 'local:update:body' });
        await expect(update.getByRole('link', { name: 'local:update:body' })).toHaveAttribute('href', '/permissions/32');
        await expect(await cellOf(table(page), update, 'Additional info')).toHaveText('Has filters');
        await expect(loadMore(page)).toBeHidden();

        expect(queries(api)).toEqual([{ limit: '30', offset: '0' }]);
    });

    test('says nothing about permissions being always assigned', async ({ page, api }) => {
        // A field that permissions no longer have.
        api.json('GET core /permissions', okList([{ ...described('global:view:member', 'View all members'), always_assigned: true }]));

        await page.goto('/permissions');

        const row = tableRows(table(page)).filter({ hasText: 'global:view:member' });
        await expect(await cellOf(table(page), row, 'Description')).toHaveText('View all members');
        await expect(await cellOf(table(page), row, 'Additional info')).toHaveText('');
    });

    test('says so when there are no permissions', async ({ page, api }) => {
        api.json('GET core /permissions', okList([]));

        await page.goto('/permissions');

        await expect.poll(() => queries(api).length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('a member who may create permissions gets a link to create one', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:create:permission'));
        api.json('GET core /permissions', okList([permission('global:view:member')]));

        await page.goto('/permissions');

        await expect(page.getByRole('link', { name: 'Create permission' })).toHaveAttribute('href', '/permissions/new');
    });

    test('a member who may not create permissions gets no such link', async ({ page, api }) => {
        api.json('GET core /permissions', okList([permission('global:view:member')]));

        await page.goto('/permissions');

        await expect(table(page).getByRole('link', { name: 'global:view:member' })).toBeVisible();
        await expect(loadMore(page)).toBeHidden();
        await expect(page.getByRole('link', { name: 'Create permission' })).toHaveCount(0);
    });

    test('searches from the first permission, and without a query once the field is empty', async ({ page, api }) => {
        api.on('GET core /permissions', ({ query }) => ({
            json: okList(query.get('query') === 'member' ? [permission('global:view:member')] : numbered(30))
        }));
        await page.goto('/permissions');
        await loadMore(page).click();
        await expect.poll(() => queries(api).at(-1)?.offset).toBe('30');

        await search(page).fill('member');

        await expect(tableRows(table(page))).toHaveText([/global:view:member/]);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0', query: 'member' });

        await search(page).fill('');

        await expect(tableRows(table(page))).toHaveCount(30);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0' });
    });

    test('shows only the answer to the last search while typing', async ({ page, api }) => {
        api.on('GET core /permissions', ({ query }) => {
            // The answer to the first letter would come last; the page doesn't wait for it.
            if (query.get('query') === 'v') {
                return { json: okList([permission('global:vote:agora')]), delayMs: 1000 };
            }
            if (query.get('query') === 'vi') return { json: okList([permission('global:view:member')]) };
            return { json: okList([permission('global:create:event')]) };
        });
        await page.goto('/permissions');
        await expect(tableRows(table(page))).toHaveText([/global:create:event/]);

        // The first search is still on its way when the second starts.
        await search(page).pressSequentially('vi');

        await expect(tableRows(table(page))).toHaveText([/global:view:member/]);
        await expect(toast(page, 'Could not fetch permissions list')).toHaveCount(0);
    });

    test('loads the next 30 permissions below the first ones, until a page is not full', async ({ page, api }) => {
        api.on('GET core /permissions', ({ query }) => (query.get('offset') === '0'
            ? { json: okList(numbered(30)) }
            : { json: okList(numbered(5, 31)), delayMs: 500 }));
        await page.goto('/permissions');
        await expect(tableRows(table(page))).toHaveCount(30);

        await loadMore(page).click();

        await expect(loadMore(page)).toBeDisabled();
        await expect(tableRows(table(page))).toHaveCount(35);
        await expect(tableRows(table(page)).first()).toContainText('global:action1:thing');
        await expect(tableRows(table(page)).last()).toContainText('global:action35:thing');
        await expect(loadMore(page)).toBeHidden();
        expect(queries(api)).toEqual([{ limit: '30', offset: '0' }, { limit: '30', offset: '30' }]);
    });

    test('sorts the permissions by their code', async ({ page, api, layout }) => {
        api.json('GET core /permissions', okList([permission('global:view:member'), permission('global:create:event'), permission('local:update:body')]));
        await page.goto('/permissions');
        await expect(tableRows(table(page))).toHaveText([/global:view:member/, /global:create:event/, /local:update:body/]);

        // Ascending first, then the other way round.
        await sortBy(table(page), 'Permission code', layout, 'desc');

        await expect(tableRows(table(page))).toHaveText([/local:update:body/, /global:view:member/, /global:create:event/]);
    });

    test('says why the permissions could not be loaded, and lets the member try again', async ({ page, api }) => {
        let failed = false;
        api.on('GET core /permissions', () => {
            if (failed) return { json: okList([permission('global:view:member')]) };
            failed = true;
            return { status: 500, json: { success: false, message: 'Something went wrong on the server.' } };
        });

        await page.goto('/permissions');

        await expect(toast(page, 'Could not fetch permissions list: Something went wrong on the server.')).toBeVisible();
        await expectEmptyTable(table(page));
        await loadMore(page).click();
        await expect(tableRows(table(page))).toHaveText([/global:view:member/]);
    });

    test('shows the permissions when what the member may do cannot be loaded', async ({ page, api, myPermissions }) => {
        api.json('GET core /permissions', okList([permission('global:view:member')]));
        // The app asks first, when it starts; the page asks again after the permissions.
        let asked = 0;
        api.on('GET core /my_permissions', () => (asked++ === 0
            ? { json: ok(myPermissions) }
            : { status: 500, json: { success: false, message: 'Something went wrong on the server.' } }));

        await page.goto('/permissions');

        await expect(toast(page, 'Could not fetch permissions list: Something went wrong on the server.')).toBeVisible();
        await expect(tableRows(table(page))).toHaveText([/global:view:member/]);
        await expect(page.getByRole('link', { name: 'Create permission' })).toHaveCount(0);
        expect(asked).toBe(2);
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('a visitor is sent to the login page', async ({ page }) => {
            await page.goto('/permissions');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/permissions');
        });
    });
});
