// A circle's members (/circles/:id/members): who is in the circle with which position, and for
// those who may, editing a position (in the "Edit user membership" dialog) and removing a member.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, ok, okList } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { circleMembership, type CircleMembership } from '../support/factories/core-circles.ts';
import { memberListItem } from '../support/factories/core-members.ts';
import { cellOf, dialog, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ERROR = { success: false, message: 'Something went wrong on the server.' };

const table = (page: Page) => page.getByRole('table');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search' });
const loadMore = (page: Page) => page.getByRole('button', { name: 'Load more members' });
const queries = (api: ApiMock) => api.callsTo('GET core /circles/:id/members').map((call) => Object.fromEntries(call.query));

const membership = (first: string, last: string, overrides: Partial<CircleMembership> = {}) => circleMembership({
    circle_id: 5,
    user: memberListItem({ first_name: first, last_name: last, username: `${first}.${last}`.toLowerCase() }),
    ...overrides
});

// `count` members named after their place in the list: "Member 1", "Member 2", ...
const numbered = (count: number, from = 1) => Array.from({ length: count }, (_, index) => membership('Member', String(from + index)));

// The members of the circle, the same for every query, and what the member may do with them.
const showMembers = (api: ApiMock, rows: CircleMembership[], combined: string[] = [], count = rows.length) => {
    api.json('GET core /circles/:id/members', okList(rows, count));
    api.json('GET core /circles/:id/my_permissions', ok(combined.map(permission)));
};

const MANAGER = ['global:view_members:circle', 'global:update_members:circle', 'global:delete_members:circle'];

test.describe('circle members', () => {
    test('lists the members with their positions and how many there are', async ({ page, api }) => {
        showMembers(api, [
            membership('Alex', 'Member', { position: 'Treasurer' }),
            membership('Bea', 'Board')
        ], [], 2);

        await page.goto('/circles/5/members');

        await expect(page.getByRole('heading', { name: 'Circle members' })).toBeVisible();
        await expect(page.getByText('Total members: 2')).toBeVisible();
        const alex = tableRows(table(page)).filter({ hasText: 'Alex Member' });
        await expect(alex.getByRole('link', { name: 'Alex Member' })).toHaveAttribute('href', '/members/alex.member');
        await expect(await cellOf(table(page), alex, 'Position')).toHaveText('Treasurer');
        await expect(await cellOf(table(page), tableRows(table(page)).filter({ hasText: 'Bea Board' }), 'Position')).toHaveText('');
        await expect(loadMore(page)).toBeHidden();

        await expect.poll(() => api.callsTo('GET core /circles/:id/members').map((call) => call.params.id)).toEqual(['5']);
        expect(queries(api)).toEqual([{ limit: '30', offset: '0' }]);
        await expect.poll(() => api.callsTo('GET core /circles/:id/my_permissions').map((call) => call.params.id)).toEqual(['5']);
    });

    test('links to the id of a member without a username', async ({ page, api }) => {
        showMembers(api, [membership('Una', 'Named', { user: memberListItem({ id: 77, username: '', first_name: 'Una', last_name: 'Named' }) })]);

        await page.goto('/circles/5/members');

        await expect(table(page).getByRole('link', { name: 'Una Named' })).toHaveAttribute('href', '/members/77');
    });

    test('says so when the circle has no members', async ({ page, api }) => {
        showMembers(api, []);

        await page.goto('/circles/5/members');

        await expect.poll(() => api.callsTo('GET core /circles/:id/my_permissions').length).toBe(1);
        await expectEmptyTable(table(page));
        await expect(page.getByText('Total members: 0')).toBeVisible();
    });

    test('managers of the members get buttons to edit and remove each of them', async ({ page, api }) => {
        showMembers(api, [membership('Alex', 'Member')], MANAGER);

        await page.goto('/circles/5/members');

        await expect(table(page).getByRole('button', { name: 'Edit Alex Member' })).toBeVisible();
        await expect(table(page).getByRole('button', { name: 'Delete Alex Member' })).toBeVisible();
    });

    test('others only see the members', async ({ page, api }) => {
        showMembers(api, [membership('Alex', 'Member')], ['global:view_members:circle']);

        await page.goto('/circles/5/members');

        await expect(table(page).getByRole('link', { name: 'Alex Member' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /circles/:id/my_permissions').length).toBe(1);
        await expect(table(page).getByRole('button')).toHaveCount(0);
    });

    test('searches from the first member, and without a query once the field is empty', async ({ page, api }) => {
        api.on('GET core /circles/:id/members', ({ query }) => ({
            json: query.get('query') === 'alex' ? okList([membership('Alex', 'Member')]) : okList(numbered(30), 40)
        }));
        api.json('GET core /circles/:id/my_permissions', ok([]));
        await page.goto('/circles/5/members');
        await loadMore(page).click();
        await expect.poll(() => queries(api).at(-1)?.offset).toBe('30');

        await search(page).fill('alex');

        await expect(tableRows(table(page))).toHaveText([/Alex Member/]);
        await expect(page.getByText('Total members: 1')).toBeVisible();
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0', query: 'alex' });

        await search(page).fill('');

        await expect(tableRows(table(page))).toHaveCount(30);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0' });
    });

    test('shows only the answer to the last search while typing', async ({ page, api }) => {
        api.on('GET core /circles/:id/members', ({ query }) => {
            // The answer to the first letter would come last; the page doesn't wait for it.
            if (query.get('query') === 'a') {
                return { json: okList([membership('Anna', 'Early')]), delayMs: 1000 };
            }
            if (query.get('query') === 'al') return { json: okList([membership('Alex', 'Member')]) };
            return { json: okList([membership('Bea', 'Board')]) };
        });
        api.json('GET core /circles/:id/my_permissions', ok([]));
        await page.goto('/circles/5/members');
        await expect(tableRows(table(page))).toHaveText([/Bea Board/]);

        // The first search is still on its way when the second starts.
        await search(page).pressSequentially('al');

        await expect(tableRows(table(page))).toHaveText([/Alex Member/]);
        await expect(toast(page, 'Could not fetch members')).toHaveCount(0);
    });

    test('loads the next 30 members below the first ones, until a page is not full', async ({ page, api }) => {
        api.on('GET core /circles/:id/members', ({ query }) => (query.get('offset') === '0'
            ? { json: okList(numbered(30), 35) }
            : { json: okList(numbered(5, 31), 35), delayMs: 500 }));
        api.json('GET core /circles/:id/my_permissions', ok([]));
        await page.goto('/circles/5/members');
        await expect(tableRows(table(page))).toHaveCount(30);

        await loadMore(page).click();

        await expect(loadMore(page)).toBeDisabled();
        await expect(tableRows(table(page))).toHaveCount(35);
        await expect(tableRows(table(page)).first()).toContainText('Member 1');
        await expect(tableRows(table(page)).last()).toContainText('Member 35');
        await expect(page.getByText('Total members: 35')).toBeVisible();
        await expect(loadMore(page)).toBeHidden();
        expect(queries(api)).toEqual([{ limit: '30', offset: '0' }, { limit: '30', offset: '30' }]);
    });

    test('sorts the members by name', async ({ page, api, layout }) => {
        showMembers(api, [membership('Bea', 'Board'), membership('Alex', 'Member'), membership('Cleo', 'Circle')]);
        await page.goto('/circles/5/members');
        await expect(tableRows(table(page))).toHaveText([/Bea Board/, /Alex Member/, /Cleo Circle/]);

        // Ascending first, then the other way round.
        await sortBy(table(page), 'Name and surname', layout, 'desc');
        await expect(tableRows(table(page))).toHaveText([/Cleo Circle/, /Bea Board/, /Alex Member/]);
    });

    test('says why the members could not be loaded, and lets the member try again', async ({ page, api }) => {
        let failed = false;
        api.on('GET core /circles/:id/members', () => {
            if (failed) return { json: okList([membership('Alex', 'Member')]) };
            failed = true;
            return { status: 403, json: forbidden('Permission view_members:circle is required, but not present.') };
        });
        api.json('GET core /circles/:id/my_permissions', ok([]));

        await page.goto('/circles/5/members');

        await expect(toast(page, 'Could not fetch members: Permission view_members:circle is required, but not present.')).toBeVisible();
        await expectEmptyTable(table(page));
        await loadMore(page).click();
        await expect(tableRows(table(page))).toHaveText([/Alex Member/]);
    });

    test.describe('removing a member', () => {
        test('asks first, then removes them from the list', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member', { id: 301 }), membership('Bea', 'Board')], MANAGER);
            api.json('DELETE core /circles/:id/members/:membership_id', { success: true, message: 'Membership is deleted.' });
            await page.goto('/circles/5/members');
            await expect(page.getByText('Total members: 2')).toBeVisible();

            await table(page).getByRole('button', { name: 'Delete Alex Member' }).click();
            const confirm = dialog(page, 'Deleting a member');
            await expect(confirm).toContainText('Are you sure you want to delete Alex Member from this circle? This action cannot be undone.');
            await confirm.getByRole('button', { name: 'Delete member' }).click();

            await expect(toast(page, 'Member is deleted.')).toBeVisible();
            await expect(tableRows(table(page))).toHaveText([/Bea Board/]);
            await expect(page.getByText('Total members: 1')).toBeVisible();
            await expect.poll(() => api.callsTo('DELETE core /circles/:id/members/:membership_id').map((call) => call.params)).toEqual([{ id: '5', membership_id: '301' }]);
        });

        test('shows a name with markup as it is written', async ({ page, api }) => {
            showMembers(api, [membership('<b>Alex</b>', 'Member')], MANAGER);
            await page.goto('/circles/5/members');

            await table(page).getByRole('button', { name: 'Delete <b>Alex</b> Member' }).click();

            await expect(dialog(page, 'Deleting a member')).toContainText('delete <b>Alex</b> Member from this circle?');
        });

        test('does nothing when the member changes their mind', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member')], MANAGER);
            await page.goto('/circles/5/members');

            await table(page).getByRole('button', { name: 'Delete Alex Member' }).click();
            await dialog(page, 'Deleting a member').getByRole('button', { name: 'Cancel' }).click();

            await expect(dialog(page, 'Deleting a member')).toBeHidden();
            await expect(tableRows(table(page))).toHaveText([/Alex Member/]);
            expect(api.callsTo('DELETE core /circles/:id/members/:membership_id')).toHaveLength(0);
        });

        test('says why the member could not be removed', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member')], MANAGER);
            api.on('DELETE core /circles/:id/members/:membership_id', { status: 403, json: forbidden('Permission delete_members:circle is required, but not present.') });
            await page.goto('/circles/5/members');

            await table(page).getByRole('button', { name: 'Delete Alex Member' }).click();
            await dialog(page, 'Deleting a member').getByRole('button', { name: 'Delete member' }).click();

            await expect(toast(page, 'Could not delete member: Permission delete_members:circle is required, but not present.')).toBeVisible();
            await expect(tableRows(table(page))).toHaveText([/Alex Member/]);
        });
    });

    test.describe('editing a position', () => {
        const position = (page: Page) => dialog(page, 'Edit user membership').getByRole('textbox', { name: 'Position' });
        const saveChanges = (page: Page) => dialog(page, 'Edit user membership').getByRole('button', { name: 'Save changes' });

        test('saves the new position and shows it in the list', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member', { id: 301, position: 'Treasurer' })], MANAGER);
            api.json('PUT core /circles/:id/members/:membership_id', ok({ id: 301, circle_id: 5, user_id: 2, position: 'President' }));
            await page.goto('/circles/5/members');
            const row = tableRows(table(page)).filter({ hasText: 'Alex Member' });

            await row.getByRole('button', { name: 'Edit Alex Member' }).click();
            await expect(position(page)).toHaveValue('Treasurer');
            await position(page).fill('President');
            await saveChanges(page).click();

            await expect(toast(page, 'Membership is updated')).toBeVisible();
            await expect(dialog(page, 'Edit user membership')).toBeHidden();
            await expect(await cellOf(table(page), row, 'Position')).toHaveText('President');
            await expect.poll(() => api.callsTo('PUT core /circles/:id/members/:membership_id').map((call) => [call.params, call.body]))
                .toEqual([[{ id: '5', membership_id: '301' }, { position: 'President' }]]);
        });

        test('can not be saved twice while it is being saved', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member')], MANAGER);
            api.on('PUT core /circles/:id/members/:membership_id', { json: ok({}), delayMs: 1000 });
            await page.goto('/circles/5/members');

            await table(page).getByRole('button', { name: 'Edit Alex Member' }).click();
            await position(page).fill('President');
            await saveChanges(page).click();

            await expect(saveChanges(page)).toBeDisabled();
            await expect(dialog(page, 'Edit user membership')).toBeHidden();
            await expect.poll(() => api.callsTo('PUT core /circles/:id/members/:membership_id')).toHaveLength(1);
        });

        test('says why the position could not be saved and keeps the dialog open', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member', { position: 'Treasurer' })], MANAGER);
            api.on('PUT core /circles/:id/members/:membership_id', { status: 500, json: ERROR });
            await page.goto('/circles/5/members');
            const row = tableRows(table(page)).filter({ hasText: 'Alex Member' });

            await row.getByRole('button', { name: 'Edit Alex Member' }).click();
            await position(page).fill('President');
            await saveChanges(page).click();

            await expect(toast(page, 'Error updating user membership: Something went wrong on the server.')).toBeVisible();
            await expect(position(page)).toHaveValue('President');
            await expect(saveChanges(page)).toBeEnabled();
            // Nothing was saved.
            await expect(await cellOf(table(page), row, 'Position')).toHaveText('Treasurer');
        });

        test('leaves the position as it was when the member cancels', async ({ page, api }) => {
            showMembers(api, [membership('Alex', 'Member', { position: 'Treasurer' })], MANAGER);
            await page.goto('/circles/5/members');
            const row = tableRows(table(page)).filter({ hasText: 'Alex Member' });

            await row.getByRole('button', { name: 'Edit Alex Member' }).click();
            await position(page).fill('President');
            await dialog(page, 'Edit user membership').getByRole('button', { name: 'Cancel' }).click();
            await expect(dialog(page, 'Edit user membership')).toBeHidden();
            await expect(await cellOf(table(page), row, 'Position')).toHaveText('Treasurer');

            await row.getByRole('button', { name: 'Edit Alex Member' }).click();
            await position(page).fill('Secretary');
            await dialog(page, 'Edit user membership').getByRole('button', { name: 'Close' }).click();
            await expect(dialog(page, 'Edit user membership')).toBeHidden();
            await expect(await cellOf(table(page), row, 'Position')).toHaveText('Treasurer');

            expect(api.callsTo('PUT core /circles/:id/members/:membership_id')).toHaveLength(0);
        });
    });
});
