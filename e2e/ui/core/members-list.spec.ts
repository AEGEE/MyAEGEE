// Members list (/members): every member of AEGEE, for those with global:view:member.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, ok, okList } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { memberListItem, type MemberListItem } from '../support/factories/core-members.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const BODIES = [body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 2, name: 'AEGEE-Other' })];

// The members of one page, the same for every query.
const showMembers = (api: ApiMock, rows: MemberListItem[], count = rows.length) => {
    api.json('GET core /bodies', ok(BODIES));
    api.json('GET core /members', okList(rows, count));
};

const table = (page: Page) => page.getByRole('table');
// The numbered button of a page in the pager, in the list of pages. Once the page has changed,
// Buefy 0.9 names the "next" and "previous" arrows after the page they go to ("Page 3."), so
// the name alone isn't enough.
const pageButton = (page: Page, number: number) => page.getByRole('listitem').getByRole('button', { name: `Page ${number}.`, exact: true });
const search = (page: Page) => page.getByRole('textbox', { name: 'Search by name or surname' });
const lastQuery = (api: ApiMock) => Object.fromEntries(api.callsTo('GET core /members').at(-1)!.query);

test.describe('members list', () => {
    test('shows each member with their details', async ({ page, api }) => {
        showMembers(api, [memberListItem({
            id: 21,
            username: 'alex.member',
            first_name: 'Alex',
            last_name: 'Member',
            notification_email: 'alex@example.org',
            date_of_birth: '1999-05-01',
            primary_body_id: 2,
            about_me: 'Likes trains',
            // 09:30 UTC is 10:30 in Brussels in winter.
            created_at: '2026-01-15T09:30:00.000Z'
        })]);

        await page.goto('/members');

        await expect(page.getByRole('heading', { name: 'User list' })).toBeVisible();
        const row = tableRows(table(page)).filter({ hasText: 'Alex Member' });
        await expect(row.getByRole('link', { name: 'Alex Member' })).toHaveAttribute('href', '/members/alex.member');
        await expect(await cellOf(table(page), row, '#')).toHaveText('21');
        await expect(await cellOf(table(page), row, 'Notification email')).toHaveText('alex@example.org');
        await expect(await cellOf(table(page), row, 'Birthday')).toHaveText('1999-05-01');
        await expect(await cellOf(table(page), row, 'Primary body')).toHaveText('AEGEE-Other');
        await expect(await cellOf(table(page), row, 'About me')).toHaveText('Likes trains');
        await expect(await cellOf(table(page), row, 'Registration date')).toHaveText('2026-01-15 10:30');

        // The first 30 members, by id.
        await expect.poll(() => api.callsTo('GET core /bodies')).toHaveLength(1);
        expect(Object.fromEntries(api.callsTo('GET core /members')[0].query)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'asc' });
    });

    test('shows "Not set." without a primary body and nothing for a body it does not know', async ({ page, api }) => {
        showMembers(api, [
            memberListItem({ first_name: 'Nora', last_name: 'Nobody', primary_body_id: null }),
            // A body that is not in the list of bodies any more.
            memberListItem({ first_name: 'Gina', last_name: 'Gone', primary_body_id: 99 })
        ]);

        await page.goto('/members');

        const rows = tableRows(table(page));
        await expect(await cellOf(table(page), rows.filter({ hasText: 'Nora Nobody' }), 'Primary body')).toHaveText('Not set.');
        await expect(await cellOf(table(page), rows.filter({ hasText: 'Gina Gone' }), 'Primary body')).toHaveText('');
    });

    test('links to the id of a member without a username', async ({ page, api }) => {
        showMembers(api, [memberListItem({ id: 77, username: '', first_name: 'Una', last_name: 'Named' })]);

        await page.goto('/members');

        await expect(table(page).getByRole('link', { name: 'Una Named' })).toHaveAttribute('href', '/members/77');
    });

    test('says so when there are no members', async ({ page, api }) => {
        showMembers(api, []);

        await page.goto('/members');

        await expect.poll(() => api.callsTo('GET core /members').length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('searches by name from the first page, and without a query once the field is empty', async ({ page, api }) => {
        api.json('GET core /bodies', ok(BODIES));
        api.on('GET core /members', ({ query }) => ({
            json: query.get('query') === 'ada'
                ? okList([memberListItem({ first_name: 'Ada', last_name: 'Lovelace' })])
                : okList([memberListItem({ first_name: 'Alex', last_name: 'Member' })], 65)
        }));
        await page.goto('/members');
        await page.getByRole('button', { name: 'Page 2.' }).click();
        await expect.poll(() => lastQuery(api).offset).toBe('30');

        await search(page).fill('ada');

        await expect(tableRows(table(page))).toHaveText([/Ada Lovelace/]);
        expect(lastQuery(api)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'asc', query: 'ada' });

        await search(page).fill('');

        await expect(tableRows(table(page))).toHaveText([/Alex Member/]);
        expect(lastQuery(api)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'asc' });
    });

    test('shows only the answer to the last search while typing', async ({ page, api }) => {
        api.json('GET core /bodies', ok(BODIES));
        api.on('GET core /members', ({ query }) => {
            // The answer to the first letter would come last; the page cancels it.
            if (query.get('query') === 'a') return { json: okList([memberListItem({ first_name: 'Anna', last_name: 'Early' })]), delayMs: 1000 };
            if (query.get('query') === 'ad') return { json: okList([memberListItem({ first_name: 'Ada', last_name: 'Lovelace' })]) };
            return { json: okList([memberListItem({ first_name: 'Alex', last_name: 'Member' })]) };
        });
        await page.goto('/members');
        await expect(tableRows(table(page))).toHaveText([/Alex Member/]);

        // The search for "a" is still on its way when the one for "ad" starts.
        await search(page).pressSequentially('ad', { delay: 300 });

        await expect(tableRows(table(page))).toHaveText([/Ada Lovelace/]);
        await expect.poll(() => api.callsTo('GET core /members').map((call) => call.query.get('query'))).toEqual([null, 'a', 'ad']);
        await expect(toast(page, 'Could not fetch user list')).toHaveCount(0);
    });

    test('asks for the next 30 members on page 2', async ({ page, api }) => {
        showMembers(api, [memberListItem()], 65);
        await page.goto('/members');

        // 65 members are 3 pages.
        await expect(page.getByRole('button', { name: 'Page 3.' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Page 4.' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Page 2.' }).click();

        await expect.poll(() => lastQuery(api)).toEqual({ limit: '30', offset: '30', sort: 'id', direction: 'asc' });
        await expect(page.getByRole('button', { name: 'Current page, Page 2.' })).toBeVisible();

        await pageButton(page, 3).click();
        await expect.poll(() => lastQuery(api).offset).toBe('60');
    });

    test('a new search starts again at page 1 of the pager', async ({ page, api }) => {
        showMembers(api, [memberListItem()], 65);
        await page.goto('/members');
        await page.getByRole('button', { name: 'Page 2.' }).click();
        await expect(page.getByRole('button', { name: 'Current page, Page 2.' })).toBeVisible();

        await search(page).fill('alex');

        await expect.poll(() => lastQuery(api)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'asc', query: 'alex' });
        await expect(page.getByRole('button', { name: 'Current page, Page 1.' })).toBeVisible();
    });

    for (const [column, field] of [['Name and surname', 'first_name'], ['Birthday', 'date_of_birth'], ['Registration date', 'created_at']] as const) {
        test(`sorts by ${column} on the server, from the first page`, async ({ page, api, layout }) => {
            showMembers(api, [memberListItem()], 65);
            await page.goto('/members');
            await page.getByRole('button', { name: 'Page 2.' }).click();
            await expect.poll(() => lastQuery(api).offset).toBe('30');

            // Ascending first, then the other way round.
            await sortBy(table(page), column, layout, 'desc');

            await expect.poll(() => api.callsTo('GET core /members').slice(2).map((call) => Object.fromEntries(call.query))).toEqual([
                { limit: '30', offset: '0', sort: field, direction: 'asc' },
                { limit: '30', offset: '0', sort: field, direction: 'desc' }
            ]);
            await expect(page.getByRole('button', { name: 'Current page, Page 1.' })).toBeVisible();
        });
    }

    test('sorts by number on the server, the other way round', async ({ page, api, layout }) => {
        showMembers(api, [memberListItem()]);
        await page.goto('/members');
        await expect.poll(() => api.callsTo('GET core /members').length).toBe(1);

        // The list starts sorted by number. Sorted by another column first, the table's own idea of
        // its sort column doesn't depend on when the default sort was applied.
        await sortBy(table(page), 'Registration date', layout);
        await expect.poll(() => lastQuery(api).sort).toBe('created_at');
        await sortBy(table(page), '#', layout, 'desc');

        await expect.poll(() => lastQuery(api)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'desc' });
    });

    test('shows why the list is not available', async ({ page, api }) => {
        api.json('GET core /bodies', ok(BODIES));
        api.on('GET core /members', { status: 403, json: forbidden('Permission global:view:member is required, but not present.') });

        await page.goto('/members');

        await expect(toast(page, 'Could not fetch user list: Permission global:view:member is required, but not present.')).toBeVisible();
        await expectEmptyTable(table(page));
    });

    test('does not ask for the members when the bodies cannot be loaded', async ({ page, api }) => {
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });

        await page.goto('/members');

        await expect(toast(page, 'Could not fetch bodies list: Something went wrong on the server.')).toBeVisible();
        await expectEmptyTable(table(page));
        expect(api.callsTo('GET core /members')).toHaveLength(0);
    });
});
