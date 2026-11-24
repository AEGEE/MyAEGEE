// Circles list (/circles): the free circles, and on request the circles bound to a body too.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { ok, okList } from '../support/factories/base.ts';
import { circle, permission, type Circle } from '../support/factories/core.ts';
import { circleDetail } from '../support/factories/core-circles.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const table = (page: Page) => page.getByRole('table');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search by name or description' });
const loadMore = (page: Page) => page.getByRole('button', { name: 'Load more circles' });
const queries = (api: ApiMock) => api.callsTo('GET core /circles').map((call) => Object.fromEntries(call.query));

// `count` circles named after their place in the list: "Circle 1", "Circle 2", ...
const numbered = (count: number, from = 1): Circle[] => Array.from({ length: count }, (_, index) => circle({ name: `Circle ${from + index}` }));

test.describe('circles list', () => {
    test('shows the free circles with their descriptions and links', async ({ page, api }) => {
        api.json('GET core /circles', okList([
            circle({ id: 41, name: 'Network Commission', description: 'Supports the antennae of a region' }),
            circle({ id: 42, name: 'IT Committee', description: 'Keeps MyAEGEE running' })
        ]));

        await page.goto('/circles');

        await expect(page.getByRole('heading', { name: 'Circles list' })).toBeVisible();
        await expect(tableRows(table(page))).toHaveCount(2);
        const network = tableRows(table(page)).filter({ hasText: 'Network Commission' });
        await expect(network.getByRole('link', { name: 'Network Commission' })).toHaveAttribute('href', '/circles/41');
        await expect(await cellOf(table(page), network, 'Description')).toHaveText('Supports the antennae of a region');
        await expect(table(page).getByRole('link', { name: 'IT Committee' })).toHaveAttribute('href', '/circles/42');
        // Fewer than a page: nothing more to load.
        await expect(loadMore(page)).toBeHidden();

        // The first 30 free circles.
        expect(queries(api)).toEqual([{ limit: '30', offset: '0', all: 'false' }]);
    });

    test('says so when there are no circles', async ({ page, api }) => {
        api.json('GET core /circles', okList([]));

        await page.goto('/circles');

        await expect.poll(() => queries(api).length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('a member who may create circles gets a link to create one', async ({ page, api, myPermissions }) => {
        // Both names: the one the page looks for and the one creating a circle needs.
        myPermissions.push(permission('global:create:free_circle'), permission('global:create:circle'));
        api.json('GET core /circles', okList([circle()]));

        await page.goto('/circles');

        await expect(page.getByRole('link', { name: 'Create circle' })).toHaveAttribute('href', '/circles/new');
    });

    test('a member who may not create circles gets no such link', async ({ page, api }) => {
        api.json('GET core /circles', okList([circle({ name: 'Network Commission' })]));

        await page.goto('/circles');

        await expect(table(page).getByRole('link', { name: 'Network Commission' })).toBeVisible();
        // Loaded once the button to load more is ready again.
        await expect(loadMore(page)).toBeHidden();
        await expect(page.getByRole('link', { name: 'Create circle' })).toHaveCount(0);
    });

    test('shows the bound circles too on request, and only the free ones again', async ({ page, api }) => {
        api.on('GET core /circles', ({ query }) => ({
            json: okList(query.get('all') === 'true'
                ? [circle({ name: 'Free circle' }), circle({ name: 'Board AEGEE-Antenna', body_id: 1 })]
                : [circle({ name: 'Free circle' })])
        }));
        await page.goto('/circles');
        await expect(tableRows(table(page))).toHaveText([/Free circle/]);

        await page.getByRole('button', { name: 'Show also bound circles' }).click();

        await expect(tableRows(table(page))).toHaveText([/Free circle/, /Board AEGEE-Antenna/]);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0', all: 'true' });

        await page.getByRole('button', { name: 'Show only free circles' }).click();

        await expect(tableRows(table(page))).toHaveText([/Free circle/]);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0', all: 'false' });
        await expect(page.getByRole('button', { name: 'Show also bound circles' })).toBeVisible();
    });

    test('searches from the first circle, and without a query once the field is empty', async ({ page, api }) => {
        api.on('GET core /circles', ({ query }) => ({
            json: okList(query.get('query') === 'network' ? [circle({ name: 'Network Commission' })] : numbered(30))
        }));
        await page.goto('/circles');
        await loadMore(page).click();
        await expect.poll(() => queries(api).at(-1)?.offset).toBe('30');

        await search(page).fill('network');

        await expect(tableRows(table(page))).toHaveText([/Network Commission/]);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0', all: 'false', query: 'network' });

        await search(page).fill('');

        await expect(tableRows(table(page))).toHaveCount(30);
        expect(queries(api).at(-1)).toEqual({ limit: '30', offset: '0', all: 'false' });
    });

    test('shows only the answer to the last search while typing', async ({ page, api }) => {
        api.on('GET core /circles', ({ query }) => {
            // The answer to the first letter would come last; the page doesn't wait for it.
            if (query.get('query') === 'n') {
                return { json: okList([circle({ name: 'North Circle' })]), delayMs: 1000 };
            }
            if (query.get('query') === 'ne') return { json: okList([circle({ name: 'Network Commission' })]) };
            return { json: okList([circle({ name: 'IT Committee' })]) };
        });
        await page.goto('/circles');
        await expect(tableRows(table(page))).toHaveText([/IT Committee/]);

        // The first search is still on its way when the second starts.
        await search(page).pressSequentially('ne');

        await expect(tableRows(table(page))).toHaveText([/Network Commission/]);
        await expect(toast(page, 'Could not fetch circles list')).toHaveCount(0);
    });

    test('loads the next 30 circles below the first ones, until a page is not full', async ({ page, api }) => {
        api.on('GET core /circles', ({ query }) => ({
            json: okList(query.get('offset') === '0' ? numbered(30) : numbered(5, 31))
        }));
        await page.goto('/circles');
        await expect(tableRows(table(page))).toHaveCount(30);

        await loadMore(page).click();

        await expect(tableRows(table(page))).toHaveCount(35);
        await expect(tableRows(table(page)).first()).toContainText('Circle 1');
        await expect(tableRows(table(page)).last()).toContainText('Circle 35');
        expect(queries(api)).toEqual([
            { limit: '30', offset: '0', all: 'false' },
            { limit: '30', offset: '30', all: 'false' }
        ]);
        await expect(loadMore(page)).toBeHidden();
    });

    test('the button to load more waits for the circles that are being loaded', async ({ page, api }) => {
        api.on('GET core /circles', ({ query }) => (query.get('offset') === '0'
            ? { json: okList(numbered(30)) }
            : { json: okList(numbered(30, 31)), delayMs: 1000 }));
        await page.goto('/circles');
        await expect(tableRows(table(page))).toHaveCount(30);

        await loadMore(page).click();

        await expect(loadMore(page)).toBeDisabled();
        await expect(tableRows(table(page))).toHaveCount(60);
        await expect(loadMore(page)).toBeEnabled();
    });

    test('says why the circles could not be loaded, and lets the member try again', async ({ page, api }) => {
        let failed = false;
        api.on('GET core /circles', () => {
            if (failed) return { json: okList([circle({ name: 'Network Commission' })]) };
            failed = true;
            return { status: 500, json: { success: false, message: 'Something went wrong on the server.' } };
        });

        await page.goto('/circles');

        await expect(toast(page, 'Could not fetch circles list: Something went wrong on the server.')).toBeVisible();
        await expectEmptyTable(table(page));
        await loadMore(page).click();
        await expect(tableRows(table(page))).toHaveText([/Network Commission/]);
    });

    test('shows the circles when what the member may do cannot be loaded', async ({ page, api, myPermissions }) => {
        api.json('GET core /circles', okList([circle({ name: 'Network Commission' })]));
        // The app asks first, when it starts; the page asks again after the circles.
        let asked = 0;
        api.on('GET core /my_permissions', () => (asked++ === 0
            ? { json: ok(myPermissions) }
            : { status: 500, json: { success: false, message: 'Something went wrong on the server.' } }));

        await page.goto('/circles');

        await expect(toast(page, 'Could not fetch circles list: Something went wrong on the server.')).toBeVisible();
        await expect(tableRows(table(page))).toHaveText([/Network Commission/]);
        await expect(page.getByRole('link', { name: 'Create circle' })).toHaveCount(0);
        expect(asked).toBe(2);
    });

    test('a circle\'s name opens its page', async ({ page, api }) => {
        api.json('GET core /circles', okList([circle({ id: 41, name: 'Network Commission' })]));
        api.json('GET core /circles/:id', ok(circleDetail({ id: 41, name: 'Network Commission' })));
        api.json('GET core /circles/:id/my_permissions', ok([]));
        api.json('GET core /circles/:id/permissions', okList([]));
        await page.goto('/circles');

        await table(page).getByRole('link', { name: 'Network Commission' }).click();

        await expect(page).toHaveURL('/circles/41');
        await expect(page.getByRole('heading', { name: 'Network Commission' })).toBeVisible();
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('a visitor is sent to the login page', async ({ page }) => {
            await page.goto('/circles');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/circles');
        });
    });
});
