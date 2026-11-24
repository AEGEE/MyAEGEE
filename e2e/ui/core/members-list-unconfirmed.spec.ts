// Unconfirmed members (/members/unconfirmed): those who signed up and never confirmed their
// address, for global:view_unconfirmed:member; global:confirm:member confirms them by hand.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, okList } from '../support/factories/base.ts';
import { memberListItem } from '../support/factories/core-members.ts';
import { cellOf, dialog, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const table = (page: Page) => page.getByRole('table');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search by name or surname' });
const queries = (api: ApiMock) => api.callsTo('GET core /members/unconfirmed').map((call) => Object.fromEntries(call.query));

const unconfirmed = (overrides: Parameters<typeof memberListItem>[0] = {}) => memberListItem({ mail_confirmed_at: null, primary_body_id: null, ...overrides });

test.describe('unconfirmed members', () => {
    test('lists them with their email and registration date', async ({ page, api }) => {
        api.json('GET core /members/unconfirmed', okList([
            unconfirmed({ id: 31, username: 'new.member', first_name: 'Nina', last_name: 'New', email: 'nina@example.org', created_at: '2026-07-01T08:15:00.000Z' }),
            unconfirmed({ id: 32, username: '', first_name: 'Otto', last_name: 'Other' })
        ]));

        await page.goto('/members/unconfirmed');

        await expect(page.getByRole('heading', { name: 'Unconfirmed user list' })).toBeVisible();
        const nina = tableRows(table(page)).filter({ hasText: 'Nina New' });
        await expect(nina.getByRole('link', { name: 'Nina New' })).toHaveAttribute('href', '/members/new.member');
        await expect(await cellOf(table(page), nina, '#')).toHaveText('31');
        await expect(await cellOf(table(page), nina, 'Email')).toHaveText('nina@example.org');
        // 08:15 UTC is 10:15 in Brussels in summer.
        await expect(await cellOf(table(page), nina, 'Registration date')).toHaveText('2026-07-01 10:15');
        // Without a username the link goes to the id.
        await expect(table(page).getByRole('link', { name: 'Otto Other' })).toHaveAttribute('href', '/members/32');

        expect(queries(api)).toEqual([{ limit: '30', offset: '0', sort: 'id', direction: 'asc' }]);
    });

    test('says so when everyone has confirmed', async ({ page, api }) => {
        api.json('GET core /members/unconfirmed', okList([]));

        await page.goto('/members/unconfirmed');

        await expect.poll(() => queries(api).length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('searches by name and pages through the list', async ({ page, api }) => {
        api.json('GET core /members/unconfirmed', okList([unconfirmed()], 45));
        await page.goto('/members/unconfirmed');

        await page.getByRole('button', { name: 'Page 2.' }).last().click();
        await expect.poll(() => queries(api).at(-1)).toEqual({ limit: '30', offset: '30', sort: 'id', direction: 'asc' });

        await search(page).fill('nina');
        await expect.poll(() => queries(api).at(-1)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'asc', query: 'nina' });
        // The pager is back on the first page.
        await expect(page.getByRole('button', { name: 'Current page, Page 1.' })).toBeVisible();
    });

    test('shows only the answer to the last search while typing', async ({ page, api }) => {
        api.on('GET core /members/unconfirmed', ({ query }) => {
            // The answer to the first letter would come last; the page cancels it.
            if (query.get('query') === 'a') return { json: okList([memberListItem({ first_name: 'Anna', last_name: 'Early' })]), delayMs: 1000 };
            if (query.get('query') === 'ad') return { json: okList([memberListItem({ first_name: 'Ada', last_name: 'Lovelace' })]) };
            return { json: okList([memberListItem({ first_name: 'Alex', last_name: 'Member' })]) };
        });
        await page.goto('/members/unconfirmed');
        await expect(tableRows(table(page))).toHaveText([/Alex Member/]);

        // The search for "a" is still on its way when the one for "ad" starts.
        await search(page).pressSequentially('ad', { delay: 300 });

        await expect(tableRows(table(page))).toHaveText([/Ada Lovelace/]);
        await expect.poll(() => api.callsTo('GET core /members/unconfirmed').map((call) => call.query.get('query'))).toEqual([null, 'a', 'ad']);
        await expect(toast(page, /Could not fetch/)).toHaveCount(0);
    });

    test('sorts on the server, from the first page', async ({ page, api, layout }) => {
        api.json('GET core /members/unconfirmed', okList([unconfirmed()], 45));
        await page.goto('/members/unconfirmed');
        await expect.poll(() => queries(api).length).toBe(1);

        await sortBy(table(page), 'Registration date', layout, 'desc');

        await expect.poll(() => queries(api).slice(1)).toEqual([
            { limit: '30', offset: '0', sort: 'created_at', direction: 'asc' },
            { limit: '30', offset: '0', sort: 'created_at', direction: 'desc' }
        ]);
    });

    test('a sort on the second page starts again on the first', async ({ page, api, layout }) => {
        api.json('GET core /members/unconfirmed', okList([unconfirmed()], 45));
        await page.goto('/members/unconfirmed');
        await page.getByRole('button', { name: 'Page 2.' }).last().click();
        await expect.poll(() => queries(api).at(-1)?.offset).toBe('30');

        await sortBy(table(page), 'Name and surname', layout);

        await expect.poll(() => queries(api).at(-1)).toEqual({ limit: '30', offset: '0', sort: 'first_name', direction: 'asc' });
        await expect(page.getByRole('button', { name: 'Current page, Page 1.' })).toBeVisible();
    });

    test('confirming asks first, then removes the member from the list', async ({ page, api }) => {
        api.json('GET core /members/unconfirmed', okList([
            unconfirmed({ id: 31, first_name: 'Nina', last_name: 'New' }),
            unconfirmed({ id: 32, first_name: 'Otto', last_name: 'Other' })
        ]));
        api.json('POST core /members/:id/confirm', { success: true, data: unconfirmed({ id: 32, mail_confirmed_at: new Date().toISOString() }) });
        await page.goto('/members/unconfirmed');

        const otto = tableRows(table(page)).filter({ hasText: 'Otto Other' });
        await otto.getByRole('button', { name: 'Confirm' }).click();
        const confirm = dialog(page, 'Confirm user');
        await expect(confirm).toContainText('Are you sure you want to confirm this user?');

        // Cancelling sends nothing.
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('POST core /members/:id/confirm')).toHaveLength(0);

        await otto.getByRole('button', { name: 'Confirm' }).click();
        await dialog(page, 'Confirm user').getByRole('button', { name: 'Confirm user' }).click();

        await expect(toast(page, 'User is confirmed.')).toBeVisible();
        await expect(tableRows(table(page))).toHaveText([/Nina New/]);
        await expect.poll(() => api.callsTo('POST core /members/:id/confirm').map((call) => [call.params.id, call.body])).toEqual([['32', undefined]]);
    });

    test('a refused confirmation keeps the member in the list', async ({ page, api }) => {
        api.json('GET core /members/unconfirmed', okList([unconfirmed({ id: 31, first_name: 'Nina', last_name: 'New' })]));
        api.on('POST core /members/:id/confirm', { status: 403, json: forbidden('Permission global:confirm:member is required, but not present.') });
        await page.goto('/members/unconfirmed');

        await tableRows(table(page)).filter({ hasText: 'Nina New' }).getByRole('button', { name: 'Confirm' }).click();
        await dialog(page, 'Confirm user').getByRole('button', { name: 'Confirm user' }).click();

        await expect(toast(page, 'Error changing user status: Permission global:confirm:member is required, but not present.')).toBeVisible();
        await expect(tableRows(table(page))).toHaveText([/Nina New/]);
    });

    test('shows why the list is not available', async ({ page, api }) => {
        api.on('GET core /members/unconfirmed', { status: 403, json: forbidden('Permission global:view_unconfirmed:member is required, but not present.') });

        await page.goto('/members/unconfirmed');

        await expect(toast(page, 'Could not fetch user list: Permission global:view_unconfirmed:member is required, but not present.')).toBeVisible();
        await expectEmptyTable(table(page));
    });
});
