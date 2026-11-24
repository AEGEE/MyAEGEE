// The list of signup campaigns (/campaigns): what it shows, who gets the link to create one,
// searching, loading more and what the page does when core fails.
import type { Page } from '@playwright/test';

import { forbidden, ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { campaign } from '../support/factories/core-campaigns.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const campaignsTable = (page: Page) => page.getByRole('table');
const loadMore = (page: Page) => page.getByRole('button', { name: 'Load more campaigns' });
const search = (page: Page) => page.getByLabel('Search');

// 30 campaigns: a full page, so the list offers to load more.
const fullPage = (from: number) => Array.from({ length: 30 }, (_, index) => campaign({ id: from + index, name: `Campaign ${String(from + index).padStart(3, '0')}` }));

test.describe('campaigns list', () => {
    test('shows the campaigns with their description and signup link', async ({ page, api }) => {
        api.json('GET core /campaigns', ok([
            campaign({ id: 7, name: 'Autumn recruitment', url: 'autumn', description_long: 'Join **AEGEE-Antenna** this autumn.' }),
            campaign({ id: 8, name: 'Spring recruitment', url: 'spring' })
        ]));

        await page.goto('/campaigns');

        await expect(page).toHaveTitle('MyAEGEE | View campaigns');
        await expect(page.getByRole('heading', { name: 'Recruitment campaigns list' })).toBeVisible();
        const table = campaignsTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        const autumn = tableRows(table).filter({ hasText: 'Autumn recruitment' });
        await expect(await cellOf(table, autumn, '#')).toHaveText('7');
        await expect(autumn.getByRole('link', { name: 'Autumn recruitment' })).toHaveAttribute('href', '/campaigns/7');
        await expect((await cellOf(table, autumn, 'Description')).getByText('AEGEE-Antenna')).toHaveJSProperty('tagName', 'STRONG');
        await expect(autumn.getByRole('link', { name: '/signup/autumn' })).toHaveAttribute('href', '/signup/autumn');
        await expect(loadMore(page)).toBeHidden();
        await expect(page.getByRole('link', { name: 'Create campaign' })).toHaveCount(0);

        const [list] = api.callsTo('GET core /campaigns');
        expect(Object.fromEntries(list.query)).toEqual({ limit: '30', offset: '0' });
    });

    test('those who may create campaigns get a link to the empty form', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:create:campaign'));
        api.json('GET core /campaigns', ok([campaign()]));
        api.json('GET core /bodies', ok([]));

        await page.goto('/campaigns');
        await page.getByRole('link', { name: 'Create campaign' }).click();

        await expect(page).toHaveURL('/campaigns/new');
        await expect(page.getByLabel('Name')).toHaveValue('');
    });

    test('says so when there are no campaigns', async ({ page, api }) => {
        api.json('GET core /campaigns', ok([]));

        await page.goto('/campaigns');

        await expect.poll(() => api.callsTo('GET core /campaigns').length).toBe(1);
        await expectEmptyTable(campaignsTable(page));
        await expect(loadMore(page)).toBeHidden();
    });

    test('a full page offers more campaigns and appends them', async ({ page, api }) => {
        api.on('GET core /campaigns', ({ query }) => ({
            json: ok(query.get('offset') === '0' ? fullPage(1) : [campaign({ id: 31, name: 'The last campaign' })])
        }));

        await page.goto('/campaigns');
        const table = campaignsTable(page);
        await expect(tableRows(table)).toHaveCount(30);
        await loadMore(page).click();

        await expect(tableRows(table)).toHaveCount(31);
        await expect(tableRows(table).filter({ hasText: 'The last campaign' })).toBeVisible();
        expect(Object.fromEntries(api.callsTo('GET core /campaigns').at(-1)!.query)).toEqual({ limit: '30', offset: '30' });
        await expect(loadMore(page)).toBeHidden();
    });

    test('loading more is disabled while the list loads', async ({ page, api }) => {
        api.on('GET core /campaigns', ({ query }) => (query.get('offset') === '0'
            ? { json: ok(fullPage(1)) }
            : { json: ok([]), delayMs: 1500 }));

        await page.goto('/campaigns');
        await expect(tableRows(campaignsTable(page))).toHaveCount(30);
        await loadMore(page).click();

        await expect(loadMore(page)).toBeDisabled();
        await expect(loadMore(page)).toBeHidden();
    });

    test('searching asks again with the text and replaces the rows', async ({ page, api }) => {
        // Slow answers, so each keystroke cancels the request of the one before.
        api.on('GET core /campaigns', ({ query }) => ({
            json: ok(query.get('query') === 'aut'
                ? [campaign({ id: 7, name: 'Autumn recruitment' })]
                : [campaign({ id: 8, name: 'Spring recruitment' })]),
            delayMs: 500
        }));

        await page.goto('/campaigns');
        const table = campaignsTable(page);
        await expect(tableRows(table).filter({ hasText: 'Spring recruitment' })).toBeVisible();
        await search(page).pressSequentially('aut', { delay: 100 });

        await expect(tableRows(table).filter({ hasText: 'Autumn recruitment' })).toBeVisible();
        await expect(tableRows(table)).toHaveCount(1);
        expect(Object.fromEntries(api.callsTo('GET core /campaigns').at(-1)!.query)).toEqual({ limit: '30', offset: '0', query: 'aut' });
        // Each keystroke cancels the request before it: no error for those. Counted at once, as a
        // toast that was shown is gone again after three seconds.
        expect(await toast(page, 'Could not fetch campaign list').count()).toBe(0);

        await search(page).fill('');

        await expect(tableRows(table).filter({ hasText: 'Spring recruitment' })).toBeVisible();
        expect(api.callsTo('GET core /campaigns').at(-1)!.query.has('query')).toBe(false);
    });

    test('asks for the permissions once, not again for every search', async ({ page, api }) => {
        api.json('GET core /campaigns', ok([campaign()]));

        await page.goto('/campaigns');
        await expect(tableRows(campaignsTable(page))).toHaveCount(1);
        // Once by the menu, once by the page.
        await expect.poll(() => api.callsTo('GET core /my_permissions').length).toBe(2);
        await search(page).fill('A');
        await search(page).fill('AE');

        await expect.poll(() => api.callsTo('GET core /campaigns').length).toBe(3);
        await expect(tableRows(campaignsTable(page))).toHaveCount(1);
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(2);
    });

    test('a failing list says why and can be tried again', async ({ page, api }) => {
        api.on('GET core /campaigns', { status: 403, json: forbidden('Permission global:view:campaign is required, but not present.') });

        await page.goto('/campaigns');

        await expect(toast(page, 'Could not fetch campaign list: Permission global:view:campaign is required, but not present.')).toBeVisible();
        await expectEmptyTable(campaignsTable(page));
        await expect(loadMore(page)).toBeEnabled();
    });

    test('failing permissions say why and keep the campaigns', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:create:campaign'));
        api.json('GET core /campaigns', ok(fullPage(1)));
        // The first answer is for the app, which logs a member out without it; the page's fails.
        let asked = 0;
        api.on('GET core /my_permissions', () => (++asked === 1
            ? { json: ok(myPermissions) }
            : { status: 500, json: { success: false, message: 'Database is down' } }));

        await page.goto('/campaigns');

        await expect(toast(page, 'Could not fetch campaign list: Database is down')).toBeVisible();
        await expect(tableRows(campaignsTable(page))).toHaveCount(30);
        await expect(loadMore(page)).toBeEnabled();
        await expect(page.getByRole('link', { name: 'Create campaign' })).toHaveCount(0);
    });

    test('sorting sorts the loaded campaigns without asking again', async ({ page, api, layout }) => {
        api.json('GET core /campaigns', ok([campaign({ id: 1, name: 'Zagreb welcome' }), campaign({ id: 2, name: 'Aachen welcome' })]));

        await page.goto('/campaigns');
        const table = campaignsTable(page);
        await expect(tableRows(table).first()).toContainText('Zagreb welcome');
        await sortBy(table, 'Campaign name', layout);

        await expect(tableRows(table).first()).toContainText('Aachen welcome');
        await sortBy(table, '#', layout, 'desc');
        await expect(tableRows(table).first()).toContainText('Aachen welcome');
        expect(api.callsTo('GET core /campaigns')).toHaveLength(1);
    });
});
